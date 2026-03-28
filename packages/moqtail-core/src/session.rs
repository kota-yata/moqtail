use crate::coding::{Decode, Encode, VarInt};
use crate::message::{
    Announce, AnnounceCancel, AnnounceOk, ClientSetup, ControlMessage, Fetch, FetchCancel,
    FetchError, FetchOk, FetchType, GoAway, ServerSetup, Subscribe, SubscribeAnnounces,
    SubscribeAnnouncesError, SubscribeAnnouncesOk, SubscribeDone, SubscribeError, SubscribeOk,
    Unsubscribe, UnsubscribeAnnounces,
};
use crate::model::*;
use async_trait::async_trait;
use futures::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use std::collections::{HashMap, HashSet};

/// Error codes used when closing a session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionCloseCode {
    NoError = 0x0,
    InternalError = 0x1,
    Unauthorized = 0x2,
    ProtocolViolation = 0x3,
    DuplicateTrackAlias = 0x4,
    ParameterLengthMismatch = 0x5,
    TooManySubscribes = 0x6,
    GoawayTimeout = 0x10,
    ControlMessageTimeout = 0x11,
    DataStreamTimeout = 0x12,
}

impl From<SessionCloseCode> for VarInt {
    fn from(v: SessionCloseCode) -> Self {
        VarInt(v as u64)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscribeState {
    Pending,
    Active,
    Done,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FetchState {
    Pending,
    Active,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscribeAnnouncesState {
    Pending,
    Done,
}

pub struct Session<T: MoqConnection> {
    conn: T,
    control_stream: T::BiStream,
    version: VarInt,
    next_subscribe_id: u64,
    subscribes: HashMap<u64, SubscribeState>,
    fetches: HashMap<u64, FetchState>,
    announces: HashSet<TrackNamespace>,
    subscribe_announces: HashMap<TrackNamespace, SubscribeAnnouncesState>,
}

impl<T: MoqConnection> Session<T> {
    /// Establish a new session as a client.
    ///
    /// This opens the control stream, sends a [`ClientSetup`] message and waits
    /// for the corresponding [`ServerSetup`].
    pub async fn new_client(mut conn: T, path: Option<String>) -> Result<Self, T::Error> {
        let mut control_stream = conn.open_bi().await?;

        // advertise support for version 1 with optional path parameter
        let mut parameters = Vec::new();
        if let Some(p) = path {
            parameters.push(SetupParameter::Path(p));
        }
        let setup = ClientSetup {
            versions: vec![VarInt(1)],
            parameters,
        };

        let mut buf = bytes::BytesMut::new();
        ControlMessage::ClientSetup(setup).encode(&mut buf);
        control_stream.write_all(&buf).await?;

        // Read the SERVER_SETUP message. For simplicity we allocate a buffer
        // large enough for typical handshake messages.
        let mut read_buf = [0u8; 1024];
        let n = control_stream.read(&mut read_buf).await?;
        let mut read_bytes = bytes::Bytes::copy_from_slice(&read_buf[..n]);

        let version = match ControlMessage::decode(&mut read_bytes) {
            Ok(ControlMessage::ServerSetup(ServerSetup {
                selected_version, ..
            })) => {
                log::info!("Session established using version {}", selected_version.0);
                selected_version
            }
            Ok(_other) => {
                log::error!("Unexpected control message during setup");
                return Err(
                    std::io::Error::new(std::io::ErrorKind::Other, "protocol error").into(),
                );
            }
            Err(_) => {
                log::error!("Failed to decode SERVER_SETUP");
                return Err(
                    std::io::Error::new(std::io::ErrorKind::Other, "protocol error").into(),
                );
            }
        };

        Ok(Self {
            conn,
            control_stream,
            version,
            next_subscribe_id: 0,
            subscribes: HashMap::new(),
            fetches: HashMap::new(),
            announces: HashSet::new(),
            subscribe_announces: HashMap::new(),
        })
    }

    pub async fn subscribe(
        &mut self,
        namespace: TrackNamespace,
        name: TrackName,
    ) -> Result<(), T::Error> {
        let sub_id = self.next_subscribe_id;
        self.next_subscribe_id += 1;

        if self.subscribes.contains_key(&sub_id) {
            return Err(
                std::io::Error::new(std::io::ErrorKind::Other, "duplicate subscribe id").into(),
            );
        }

        let msg = Subscribe {
            subscribe_id: VarInt(sub_id),
            track_alias: VarInt(sub_id),
            track_namespace: namespace,
            track_name: name,
            // Use the middle of the range (128) as the default subscriber
            // priority so users can increase or decrease it as needed.
            subscriber_priority: 128,
            group_order: GroupOrder::Publisher,
            filter_type: SubscribeFilter::LatestObject,
            start_group: None,
            start_object: None,
            end_group: None,
            parameters: Vec::new(),
        };

        let mut buf = bytes::BytesMut::new();
        ControlMessage::Subscribe(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;

        self.subscribes.insert(sub_id, SubscribeState::Pending);

        // Wait for a response on the control stream. In a fully fledged
        // implementation we would handle interleaved messages, but for now we
        // simply expect the next message to correspond to this subscribe.
        let mut read_buf = [0u8; 1024];
        let n = self.control_stream.read(&mut read_buf).await?;
        let mut bytes = bytes::Bytes::copy_from_slice(&read_buf[..n]);

        match ControlMessage::decode(&mut bytes) {
            Ok(ControlMessage::SubscribeOk(SubscribeOk { subscribe_id, .. }))
                if subscribe_id.0 == sub_id =>
            {
                self.subscribes.insert(sub_id, SubscribeState::Active);
                Ok(())
            }
            Ok(ControlMessage::SubscribeError(SubscribeError { reason_phrase, .. })) => {
                log::error!("subscribe failed: {}", reason_phrase);
                self.subscribes.remove(&sub_id);
                Err(std::io::Error::new(std::io::ErrorKind::Other, reason_phrase).into())
            }
            Ok(_other) => {
                log::error!("unexpected control message");
                Err(std::io::Error::new(std::io::ErrorKind::Other, "protocol error").into())
            }
            Err(_) => Err(std::io::Error::new(std::io::ErrorKind::Other, "decode error").into()),
        }
    }

    pub async fn unsubscribe(&mut self, subscribe_id: u64) -> Result<(), T::Error> {
        let msg = Unsubscribe {
            subscribe_id: VarInt(subscribe_id as u64),
        };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::Unsubscribe(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        self.subscribes.remove(&subscribe_id);
        Ok(())
    }

    pub async fn subscribe_announces(&mut self, namespace: TrackNamespace) -> Result<(), T::Error> {
        let msg = SubscribeAnnounces {
            track_namespace_prefix: namespace.clone(),
            parameters: Vec::new(),
        };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::SubscribeAnnounces(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        self.subscribe_announces
            .insert(namespace.clone(), SubscribeAnnouncesState::Pending);

        let mut read_buf = [0u8; 1024];
        let n = self.control_stream.read(&mut read_buf).await?;
        let mut bytes = bytes::Bytes::copy_from_slice(&read_buf[..n]);

        match ControlMessage::decode(&mut bytes) {
            Ok(ControlMessage::SubscribeAnnouncesOk(_)) => {
                self.subscribe_announces
                    .insert(namespace, SubscribeAnnouncesState::Done);
                Ok(())
            }
            Ok(ControlMessage::SubscribeAnnouncesError(e)) => {
                self.subscribe_announces
                    .insert(namespace, SubscribeAnnouncesState::Done);
                Err(std::io::Error::new(std::io::ErrorKind::Other, e.reason_phrase).into())
            }
            _ => Err(std::io::Error::new(std::io::ErrorKind::Other, "protocol error").into()),
        }
    }

    pub async fn unsubscribe_announces(
        &mut self,
        namespace: TrackNamespace,
    ) -> Result<(), T::Error> {
        let msg = UnsubscribeAnnounces {
            track_namespace_prefix: namespace.clone(),
        };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::UnsubscribeAnnounces(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        self.subscribe_announces.remove(&namespace);
        Ok(())
    }

    pub async fn announce_cancel(&mut self, namespace: TrackNamespace) -> Result<(), T::Error> {
        let msg = AnnounceCancel {
            track_namespace: namespace.clone(),
            error_code: VarInt(0),
            reason_phrase: String::new(),
        };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::AnnounceCancel(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        self.announces.remove(&namespace);
        Ok(())
    }

    pub async fn fetch(
        &mut self,
        namespace: TrackNamespace,
        name: TrackName,
    ) -> Result<u64, T::Error> {
        let id = self.next_subscribe_id;
        self.next_subscribe_id += 1;

        if self.fetches.contains_key(&id) {
            return Err(
                std::io::Error::new(std::io::ErrorKind::Other, "duplicate fetch id").into(),
            );
        }

        let msg = Fetch {
            subscribe_id: VarInt(id),
            subscriber_priority: 0,
            group_order: GroupOrder::Publisher,
            fetch_type: FetchType::Standalone,
            track_namespace: Some(namespace),
            track_name: Some(name),
            start_group: Some(VarInt(0)),
            start_object: Some(VarInt(0)),
            end_group: Some(VarInt(0)),
            end_object: Some(VarInt(0)),
            joining_subscribe_id: None,
            preceding_group_offset: None,
            parameters: Vec::new(),
        };

        let mut buf = bytes::BytesMut::new();
        ControlMessage::Fetch(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;

        self.fetches.insert(id, FetchState::Pending);

        let mut read_buf = [0u8; 1024];
        let n = self.control_stream.read(&mut read_buf).await?;
        let mut bytes = bytes::Bytes::copy_from_slice(&read_buf[..n]);

        match ControlMessage::decode(&mut bytes) {
            Ok(ControlMessage::FetchOk(FetchOk { subscribe_id, .. })) if subscribe_id.0 == id => {
                self.fetches.insert(id, FetchState::Active);
                Ok(id)
            }
            Ok(ControlMessage::FetchError(FetchError { reason_phrase, .. })) => {
                self.fetches.remove(&id);
                Err(std::io::Error::new(std::io::ErrorKind::Other, reason_phrase).into())
            }
            _ => Err(std::io::Error::new(std::io::ErrorKind::Other, "protocol error").into()),
        }
    }

    pub async fn fetch_cancel(&mut self, id: u64) -> Result<(), T::Error> {
        let msg = FetchCancel {
            subscribe_id: VarInt(id),
        };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::FetchCancel(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        self.fetches.remove(&id);
        Ok(())
    }

    pub async fn handle_control_message(&mut self, msg: ControlMessage) -> Result<(), T::Error> {
        match msg {
            ControlMessage::SubscribeOk(SubscribeOk { subscribe_id, .. }) => {
                match self.subscribes.get(&subscribe_id.0) {
                    Some(SubscribeState::Pending) => {
                        self.subscribes
                            .insert(subscribe_id.0, SubscribeState::Active);
                    }
                    _ => {
                        self.close(
                            SessionCloseCode::ProtocolViolation,
                            "duplicate SUBSCRIBE response",
                        )
                        .await?;
                    }
                }
            }
            ControlMessage::SubscribeError(SubscribeError { subscribe_id, .. }) => {
                match self.subscribes.remove(&subscribe_id.0) {
                    Some(SubscribeState::Pending) => {}
                    _ => {
                        self.close(
                            SessionCloseCode::ProtocolViolation,
                            "duplicate SUBSCRIBE response",
                        )
                        .await?;
                    }
                }
            }
            ControlMessage::SubscribeDone(SubscribeDone { subscribe_id, .. }) => {
                self.subscribes.remove(&subscribe_id.0);
            }
            ControlMessage::FetchOk(FetchOk { subscribe_id, .. }) => {
                match self.fetches.get(&subscribe_id.0) {
                    Some(FetchState::Pending) => {
                        self.fetches.insert(subscribe_id.0, FetchState::Active);
                    }
                    _ => {
                        self.close(
                            SessionCloseCode::ProtocolViolation,
                            "duplicate FETCH response",
                        )
                        .await?;
                    }
                }
            }
            ControlMessage::FetchError(FetchError { subscribe_id, .. }) => {
                match self.fetches.remove(&subscribe_id.0) {
                    Some(FetchState::Pending) | Some(FetchState::Active) => {}
                    _ => {
                        self.close(
                            SessionCloseCode::ProtocolViolation,
                            "duplicate FETCH response",
                        )
                        .await?;
                    }
                }
            }
            ControlMessage::Announce(Announce {
                track_namespace, ..
            }) => {
                if !self.announces.insert(track_namespace.clone()) {
                    self.close(SessionCloseCode::ProtocolViolation, "duplicate ANNOUNCE")
                        .await?;
                } else {
                    let resp = ControlMessage::AnnounceOk(AnnounceOk { track_namespace });
                    let mut buf = bytes::BytesMut::new();
                    resp.encode(&mut buf);
                    self.control_stream.write_all(&buf).await?;
                }
            }
            ControlMessage::SubscribeAnnouncesOk(SubscribeAnnouncesOk {
                track_namespace_prefix,
            }) => match self.subscribe_announces.get_mut(&track_namespace_prefix) {
                Some(SubscribeAnnouncesState::Pending) => {
                    self.subscribe_announces
                        .insert(track_namespace_prefix, SubscribeAnnouncesState::Done);
                }
                _ => {
                    self.close(
                        SessionCloseCode::ProtocolViolation,
                        "duplicate SUBSCRIBE_ANNOUNCES response",
                    )
                    .await?;
                }
            },
            ControlMessage::SubscribeAnnouncesError(SubscribeAnnouncesError {
                track_namespace_prefix,
                ..
            }) => match self.subscribe_announces.get_mut(&track_namespace_prefix) {
                Some(SubscribeAnnouncesState::Pending) => {
                    self.subscribe_announces
                        .insert(track_namespace_prefix, SubscribeAnnouncesState::Done);
                }
                _ => {
                    self.close(
                        SessionCloseCode::ProtocolViolation,
                        "duplicate SUBSCRIBE_ANNOUNCES response",
                    )
                    .await?;
                }
            },
            ControlMessage::AnnounceCancel(AnnounceCancel {
                track_namespace, ..
            }) => {
                self.announces.remove(&track_namespace);
            }
            _ => {}
        }
        Ok(())
    }

    /// Simple event loop that polls the underlying transport for new events.
    /// The current implementation only drains events and logs unexpected ones.
    pub async fn run(&mut self) -> Result<(), T::Error> {
        loop {
            match T::poll_event(&mut self.conn).await? {
                TransportEvent::BiStream(_) => {
                    // Only one bidirectional stream (the control stream) is used
                    // in the current draft. Receiving another is a protocol violation.
                    log::warn!("unexpected bidirectional stream received");
                    self.conn
                        .close(
                            SessionCloseCode::ProtocolViolation.into(),
                            "unexpected bidirectional stream",
                        )
                        .await?;
                    break;
                }
                TransportEvent::UniStream(mut _s) => {
                    // Handling of data streams is out of scope for this example.
                }
                TransportEvent::Datagram(_d) => {
                    // Datagram support is optional; ignore for now.
                }
                TransportEvent::ConnectionClosed => break,
            }
        }
        Ok(())
    }

    /// Send a GOAWAY control message to initiate session migration.
    pub async fn send_goaway(&mut self, new_session_uri: String) -> Result<(), T::Error> {
        let msg = GoAway { new_session_uri };
        let mut buf = bytes::BytesMut::new();
        ControlMessage::GoAway(msg).encode(&mut buf);
        self.control_stream.write_all(&buf).await?;
        Ok(())
    }

    /// Close the underlying connection with the given error code and reason.
    pub async fn close(&mut self, code: SessionCloseCode, reason: &str) -> Result<(), T::Error> {
        self.conn.close(code.into(), reason).await
    }

}

pub enum TransportEvent<Bi, Uni, Dgram> {
    BiStream(Bi),
    UniStream(Uni),
    Datagram(Dgram),
    ConnectionClosed,
}

#[async_trait(?Send)]
pub trait MoqTransport {
    type Connection: MoqConnection;
    type Error: std::error::Error;

    async fn connect(&self, url: &str) -> Result<Self::Connection, Self::Error>;
}

#[async_trait(?Send)]
pub trait MoqConnection {
    type BiStream: AsyncRead + AsyncWrite + Unpin;
    type UniStream: AsyncWrite + Unpin;
    type Datagram: AsRef<[u8]>;
    type Error: std::error::Error + From<std::io::Error>;

    async fn open_bi(&mut self) -> Result<Self::BiStream, Self::Error>;
    async fn open_uni(&mut self) -> Result<Self::UniStream, Self::Error>;
    async fn send_datagram(&mut self, data: &[u8]) -> Result<(), Self::Error>;
    async fn poll_event(
        &mut self,
    ) -> Result<TransportEvent<Self::BiStream, Self::UniStream, Self::Datagram>, Self::Error>;

    async fn close(&mut self, code: VarInt, reason: &str) -> Result<(), Self::Error>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::{executor::block_on, io::Cursor};
    use std::io;
    use std::sync::{Arc, Mutex};

    use std::collections::VecDeque;

    struct DummyBiStream {
        reads: VecDeque<Cursor<Vec<u8>>>,
        written: Arc<Mutex<Vec<u8>>>,
    }

    impl AsyncRead for DummyBiStream {
        fn poll_read(
            mut self: std::pin::Pin<&mut Self>,
            cx: &mut std::task::Context<'_>,
            buf: &mut [u8],
        ) -> std::task::Poll<Result<usize, io::Error>> {
            loop {
                if let Some(front) = self.reads.front_mut() {
                    match std::pin::Pin::new(front).poll_read(cx, buf)? {
                        std::task::Poll::Ready(0) => {
                            self.reads.pop_front();
                            continue;
                        }
                        std::task::Poll::Ready(n) => return std::task::Poll::Ready(Ok(n)),
                        std::task::Poll::Pending => return std::task::Poll::Pending,
                    }
                } else {
                    return std::task::Poll::Ready(Ok(0));
                }
            }
        }
    }

    impl AsyncWrite for DummyBiStream {
        fn poll_write(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
            buf: &[u8],
        ) -> std::task::Poll<Result<usize, io::Error>> {
            let mut data = self.written.lock().unwrap();
            data.extend_from_slice(buf);
            std::task::Poll::Ready(Ok(buf.len()))
        }

        fn poll_flush(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), io::Error>> {
            std::task::Poll::Ready(Ok(()))
        }

        fn poll_close(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), io::Error>> {
            std::task::Poll::Ready(Ok(()))
        }
    }

    impl Unpin for DummyBiStream {}

    struct DummyUniStream;

    impl AsyncWrite for DummyUniStream {
        fn poll_write(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
            _buf: &[u8],
        ) -> std::task::Poll<Result<usize, io::Error>> {
            std::task::Poll::Ready(Ok(0))
        }

        fn poll_flush(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), io::Error>> {
            std::task::Poll::Ready(Ok(()))
        }

        fn poll_close(
            self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), io::Error>> {
            std::task::Poll::Ready(Ok(()))
        }
    }

    impl Unpin for DummyUniStream {}

    struct MockConnection {
        read: VecDeque<Vec<u8>>,
        written: Arc<Mutex<Vec<u8>>>,
        closed: Arc<Mutex<Option<(u64, String)>>>,
    }

    #[async_trait(?Send)]
    impl MoqConnection for MockConnection {
        type BiStream = DummyBiStream;
        type UniStream = DummyUniStream;
        type Datagram = Vec<u8>;
        type Error = io::Error;

        async fn open_bi(&mut self) -> Result<Self::BiStream, Self::Error> {
            let reads = self
                .read
                .drain(..)
                .map(|v| Cursor::new(v))
                .collect::<VecDeque<_>>();
            Ok(DummyBiStream {
                reads,
                written: self.written.clone(),
            })
        }

        async fn open_uni(&mut self) -> Result<Self::UniStream, Self::Error> {
            Ok(DummyUniStream)
        }

        async fn send_datagram(&mut self, _data: &[u8]) -> Result<(), Self::Error> {
            Ok(())
        }

        async fn poll_event(
            &mut self,
        ) -> Result<TransportEvent<Self::BiStream, Self::UniStream, Self::Datagram>, Self::Error>
        {
            Ok(TransportEvent::ConnectionClosed)
        }

        async fn close(&mut self, code: VarInt, reason: &str) -> Result<(), Self::Error> {
            let mut c = self.closed.lock().unwrap();
            *c = Some((code.into_inner(), reason.to_string()));
            Ok(())
        }
    }

    #[test]
    fn client_setup_includes_path() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut resp = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut resp);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![resp.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let _ = Session::new_client(conn, Some("/foo".to_string()))
                .await
                .unwrap();

            let data = written.lock().unwrap();
            let mut bytes = bytes::Bytes::copy_from_slice(&data);
            match ControlMessage::decode(&mut bytes).unwrap() {
                ControlMessage::ClientSetup(cs) => {
                    assert_eq!(cs.versions, vec![VarInt(1)]);
                    assert!(
                        matches!(cs.parameters.get(0), Some(SetupParameter::Path(p)) if p == "/foo")
                    );
                }
                _ => panic!("unexpected message"),
            }
        });
    }

    #[test]
    fn subscribe_ok_updates_state() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let sub_ok = SubscribeOk {
                subscribe_id: VarInt(0),
                expires: VarInt(0),
                group_order: GroupOrder::Publisher,
                content_exists: false,
                largest_group_id: None,
                largest_object_id: None,
                parameters: Vec::new(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);
            let mut ok_bytes = bytes::BytesMut::new();
            ControlMessage::SubscribeOk(sub_ok).encode(&mut ok_bytes);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec(), ok_bytes.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();

            sess.subscribe(
                vec![bytes::Bytes::from_static(b"ns")],
                bytes::Bytes::from_static(b"track"),
            )
            .await
            .unwrap();

            assert!(matches!(
                sess.subscribes.get(&0),
                Some(SubscribeState::Active)
            ));
        });
    }

    #[test]
    fn fetch_ok_updates_state() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let fetch_ok = FetchOk {
                subscribe_id: VarInt(0),
                group_order: GroupOrder::Publisher,
                end_of_track: false,
                largest_group_id: VarInt(0),
                largest_object_id: VarInt(0),
                parameters: Vec::new(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);
            let mut ok_bytes = bytes::BytesMut::new();
            ControlMessage::FetchOk(fetch_ok).encode(&mut ok_bytes);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec(), ok_bytes.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();

            sess.fetch(
                vec![bytes::Bytes::from_static(b"ns")],
                bytes::Bytes::from_static(b"track"),
            )
            .await
            .unwrap();

            assert!(matches!(sess.fetches.get(&0), Some(FetchState::Active)));
        });
    }

    #[test]
    fn subscribe_done_updates_state() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let sub_done = SubscribeDone {
                subscribe_id: VarInt(0),
                status_code: VarInt(0),
                stream_count: VarInt(0),
                reason_phrase: "done".into(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);
            let mut done_bytes = bytes::BytesMut::new();
            ControlMessage::SubscribeDone(sub_done).encode(&mut done_bytes);

            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec(), done_bytes.to_vec()]),
                written: Arc::new(Mutex::new(Vec::new())),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.handle_control_message(ControlMessage::SubscribeOk(SubscribeOk {
                subscribe_id: VarInt(0),
                expires: VarInt(0),
                group_order: GroupOrder::Publisher,
                content_exists: false,
                largest_group_id: None,
                largest_object_id: None,
                parameters: Vec::new(),
            }))
            .await
            .unwrap();

            sess.handle_control_message(ControlMessage::SubscribeDone(SubscribeDone {
                subscribe_id: VarInt(0),
                status_code: VarInt(0),
                stream_count: VarInt(0),
                reason_phrase: "done".into(),
            }))
            .await
            .unwrap();

            assert!(sess.subscribes.get(&0).is_none());
        });
    }

    #[test]
    fn fetch_error_updates_state() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let fetch_err = FetchError {
                subscribe_id: VarInt(0),
                error_code: VarInt(1),
                reason_phrase: "err".into(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);
            let mut err_bytes = bytes::BytesMut::new();
            ControlMessage::FetchError(fetch_err).encode(&mut err_bytes);

            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec(), err_bytes.to_vec()]),
                written: Arc::new(Mutex::new(Vec::new())),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.handle_control_message(ControlMessage::FetchOk(FetchOk {
                subscribe_id: VarInt(0),
                group_order: GroupOrder::Publisher,
                end_of_track: false,
                largest_group_id: VarInt(0),
                largest_object_id: VarInt(0),
                parameters: Vec::new(),
            }))
            .await
            .unwrap();
            sess.handle_control_message(ControlMessage::FetchError(FetchError {
                subscribe_id: VarInt(0),
                error_code: VarInt(1),
                reason_phrase: "err".into(),
            }))
            .await
            .unwrap();

            assert!(sess.fetches.get(&0).is_none());
        });
    }

    #[test]
    fn duplicate_subscribe_response_closes_session() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);

            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec()]),
                written: Arc::new(Mutex::new(Vec::new())),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            let resp1 = ControlMessage::SubscribeOk(SubscribeOk {
                subscribe_id: VarInt(0),
                expires: VarInt(0),
                group_order: GroupOrder::Publisher,
                content_exists: false,
                largest_group_id: None,
                largest_object_id: None,
                parameters: Vec::new(),
            });
            let resp2 = ControlMessage::SubscribeOk(SubscribeOk {
                subscribe_id: VarInt(0),
                expires: VarInt(0),
                group_order: GroupOrder::Publisher,
                content_exists: false,
                largest_group_id: None,
                largest_object_id: None,
                parameters: Vec::new(),
            });
            sess.handle_control_message(resp1).await.unwrap();
            sess.handle_control_message(resp2).await.unwrap();

            let closed = sess.conn.closed.lock().unwrap().clone();
            assert!(closed.is_some());
        });
    }

    #[test]
    fn duplicate_subscribe_announces_response_closes_session() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);

            // first response will be consumed by subscribe_announces()
            let mut ok_bytes = bytes::BytesMut::new();
            ControlMessage::SubscribeAnnouncesOk(SubscribeAnnouncesOk {
                track_namespace_prefix: vec![bytes::Bytes::from_static(b"ns")],
            })
            .encode(&mut ok_bytes);

            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec(), ok_bytes.to_vec()]),
                written: Arc::new(Mutex::new(Vec::new())),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.subscribe_announces(vec![bytes::Bytes::from_static(b"ns")])
                .await
                .unwrap();

            // duplicate response should trigger protocol violation
            sess.handle_control_message(ControlMessage::SubscribeAnnouncesOk(
                SubscribeAnnouncesOk {
                    track_namespace_prefix: vec![bytes::Bytes::from_static(b"ns")],
                },
            ))
            .await
            .unwrap();

            let closed = sess.conn.closed.lock().unwrap().clone();
            assert!(closed.is_some());
        });
    }

    #[test]
    fn unsubscribe_announces_message_sent() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut resp = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut resp);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![resp.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.unsubscribe_announces(vec![bytes::Bytes::from_static(b"ns")])
                .await
                .unwrap();

            let data = written.lock().unwrap();
            let mut bytes = bytes::Bytes::from(data.clone());
            let _setup = ControlMessage::decode(&mut bytes).unwrap();
            let msg = ControlMessage::decode(&mut bytes).unwrap();
            match msg {
                ControlMessage::UnsubscribeAnnounces(u) => {
                    assert_eq!(u.track_namespace_prefix.len(), 1);
                }
                _ => panic!("wrong message"),
            }
        });
    }

    #[test]
    fn announce_ok_sent_and_tracked() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut resp = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut resp);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![resp.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.handle_control_message(ControlMessage::Announce(Announce {
                track_namespace: vec![bytes::Bytes::from_static(b"ns")],
                parameters: Vec::new(),
            }))
            .await
            .unwrap();

            assert!(
                sess.announces
                    .contains(&vec![bytes::Bytes::from_static(b"ns")])
            );

            let data = written.lock().unwrap();
            let mut bytes = bytes::Bytes::from(data.clone());
            let _setup = ControlMessage::decode(&mut bytes).unwrap();
            let resp = ControlMessage::decode(&mut bytes).unwrap();
            match resp {
                ControlMessage::AnnounceOk(_) => {}
                _ => panic!("expected AnnounceOk"),
            }
        });
    }

    #[test]
    fn goaway_message_sent() {
        block_on(async {
            let server_setup = ServerSetup {
                selected_version: VarInt(1),
                parameters: Vec::new(),
            };
            let mut server_bytes = bytes::BytesMut::new();
            ControlMessage::ServerSetup(server_setup).encode(&mut server_bytes);

            let written = Arc::new(Mutex::new(Vec::new()));
            let conn = MockConnection {
                read: VecDeque::from(vec![server_bytes.to_vec()]),
                written: written.clone(),
                closed: Arc::new(Mutex::new(None)),
            };

            let mut sess = Session::new_client(conn, None).await.unwrap();
            sess.send_goaway("moq://new".to_string()).await.unwrap();

            let data = written.lock().unwrap();
            let mut bytes = bytes::Bytes::from(data.clone());
            // first message is client setup, second is GOAWAY
            let _setup = ControlMessage::decode(&mut bytes).unwrap();
            let goaway = ControlMessage::decode(&mut bytes).unwrap();
            match goaway {
                ControlMessage::GoAway(g) => assert_eq!(g.new_session_uri, "moq://new"),
                _ => panic!("expected GOAWAY"),
            }
        });
    }
}
