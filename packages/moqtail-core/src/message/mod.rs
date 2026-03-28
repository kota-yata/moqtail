pub mod announce;
pub mod announce_cancel;
pub mod announce_error;
pub mod announce_ok;
pub mod client_setup;
pub mod fetch;
pub mod fetch_cancel;
pub mod fetch_error;
pub mod fetch_ok;
pub mod goaway;
pub mod max_subscribe_id;
pub mod server_setup;
pub mod subscribe;
pub mod subscribe_announces;
pub mod subscribe_announces_error;
pub mod subscribe_announces_ok;
pub mod subscribe_done;
pub mod subscribe_error;
pub mod subscribe_ok;
pub mod subscribe_update;
pub mod subscribes_blocked;
pub mod track_status;
pub mod track_status_request;
pub mod unannounce;
pub mod unsubscribe;
pub mod unsubscribe_announces;

pub use announce::*;
pub use announce_cancel::*;
pub use announce_error::*;
pub use announce_ok::*;
pub use client_setup::*;
pub use fetch::*;
pub use fetch_cancel::*;
pub use fetch_error::*;
pub use fetch_ok::*;
pub use goaway::*;
pub use max_subscribe_id::*;
pub use server_setup::*;
pub use subscribe::*;
pub use subscribe_announces::*;
pub use subscribe_announces_error::*;
pub use subscribe_announces_ok::*;
pub use subscribe_done::*;
pub use subscribe_error::*;
pub use subscribe_ok::*;
pub use subscribe_update::*;
pub use subscribes_blocked::*;
pub use track_status::*;
pub use track_status_request::*;
pub use unannounce::*;
pub use unsubscribe::*;
pub use unsubscribe_announces::*;

use crate::coding::{Decode, Encode, VarInt};
use bytes::Buf;

/// [Control Messages](https://datatracker.ietf.org/doc/html/draft-ietf-moq-transport-10#section-8)
pub enum ControlMessage {
    ClientSetup(ClientSetup),
    ServerSetup(ServerSetup),
    GoAway(GoAway),
    MaxSubscribeId(MaxSubscribeId),
    SubscribesBlocked(SubscribesBlocked),
    Subscribe(Subscribe),
    SubscribeOk(SubscribeOk),
    SubscribeError(SubscribeError),
    Unsubscribe(Unsubscribe),
    SubscribeUpdate(SubscribeUpdate),
    SubscribeDone(SubscribeDone),
    Fetch(Fetch),
    FetchOk(FetchOk),
    FetchError(FetchError),
    FetchCancel(FetchCancel),
    TrackStatusRequest(TrackStatusRequest),
    TrackStatus(TrackStatus),
    Announce(Announce),
    AnnounceOk(AnnounceOk),
    AnnounceError(AnnounceError),
    Unannounce(Unannounce),
    AnnounceCancel(AnnounceCancel),
    SubscribeAnnounces(SubscribeAnnounces),
    SubscribeAnnouncesOk(SubscribeAnnouncesOk),
    SubscribeAnnouncesError(SubscribeAnnouncesError),
    UnsubscribeAnnounces(UnsubscribeAnnounces),
}

pub enum ControlMessageType {
    ClientSetup = 0x40,
    ServerSetup = 0x41,
    GoAway = 0x10,
    MaxSubscribeId = 0x15,
    SubscribesBlocked = 0x1A,
    Subscribe = 0x03,
    SubscribeOk = 0x04,
    SubscribeError = 0x05,
    Unsubscribe = 0x0A,
    SubscribeUpdate = 0x02,
    SubscribeDone = 0x0B,
    Fetch = 0x16,
    FetchOk = 0x18,
    FetchError = 0x19,
    FetchCancel = 0x17,
    TrackStatusRequest = 0x0D,
    TrackStatus = 0x0E,
    Announce = 0x06,
    AnnounceOk = 0x07,
    AnnounceError = 0x08,
    Unannounce = 0x09,
    AnnounceCancel = 0x0C,
    SubscribeAnnounces = 0x11,
    SubscribeAnnouncesOk = 0x12,
    SubscribeAnnouncesError = 0x13,
    UnsubscribeAnnounces = 0x14,
}

impl Encode for ControlMessage {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        match self {
            ControlMessage::ClientSetup(msg) => {
                VarInt(ControlMessageType::ClientSetup as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::ServerSetup(msg) => {
                VarInt(ControlMessageType::ServerSetup as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::GoAway(msg) => {
                VarInt(ControlMessageType::GoAway as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::MaxSubscribeId(msg) => {
                VarInt(ControlMessageType::MaxSubscribeId as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribesBlocked(msg) => {
                VarInt(ControlMessageType::SubscribesBlocked as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::Subscribe(msg) => {
                VarInt(ControlMessageType::Subscribe as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeOk(msg) => {
                VarInt(ControlMessageType::SubscribeOk as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeError(msg) => {
                VarInt(ControlMessageType::SubscribeError as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::Unsubscribe(msg) => {
                VarInt(ControlMessageType::Unsubscribe as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeUpdate(msg) => {
                VarInt(ControlMessageType::SubscribeUpdate as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeDone(msg) => {
                VarInt(ControlMessageType::SubscribeDone as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::Fetch(msg) => {
                VarInt(ControlMessageType::Fetch as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::FetchOk(msg) => {
                VarInt(ControlMessageType::FetchOk as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::FetchError(msg) => {
                VarInt(ControlMessageType::FetchError as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::FetchCancel(msg) => {
                VarInt(ControlMessageType::FetchCancel as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::TrackStatusRequest(msg) => {
                VarInt(ControlMessageType::TrackStatusRequest as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::TrackStatus(msg) => {
                VarInt(ControlMessageType::TrackStatus as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::Announce(msg) => {
                VarInt(ControlMessageType::Announce as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::AnnounceOk(msg) => {
                VarInt(ControlMessageType::AnnounceOk as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::AnnounceError(msg) => {
                VarInt(ControlMessageType::AnnounceError as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::Unannounce(msg) => {
                VarInt(ControlMessageType::Unannounce as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::AnnounceCancel(msg) => {
                VarInt(ControlMessageType::AnnounceCancel as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeAnnounces(msg) => {
                VarInt(ControlMessageType::SubscribeAnnounces as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeAnnouncesOk(msg) => {
                VarInt(ControlMessageType::SubscribeAnnouncesOk as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::SubscribeAnnouncesError(msg) => {
                VarInt(ControlMessageType::SubscribeAnnouncesError as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
            ControlMessage::UnsubscribeAnnounces(msg) => {
                VarInt(ControlMessageType::UnsubscribeAnnounces as u64).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                msg.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put(tmp);
            }
        }
    }
}

impl<'a> Decode<'a> for ControlMessage {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let msg_type = VarInt::decode(buf)?;
        let len = VarInt::decode(buf)?.into_inner() as usize;

        if buf.remaining() < len {
            return Err(crate::coding::Error::UnexpectedEnd);
        }

        let mut data = buf.copy_to_bytes(len);

        let msg = match msg_type.into_inner() {
            val if val == ControlMessageType::ClientSetup as u64 => {
                ControlMessage::ClientSetup(ClientSetup::decode(&mut data)?)
            }
            val if val == ControlMessageType::ServerSetup as u64 => {
                ControlMessage::ServerSetup(ServerSetup::decode(&mut data)?)
            }
            val if val == ControlMessageType::GoAway as u64 => {
                ControlMessage::GoAway(GoAway::decode(&mut data)?)
            }
            val if val == ControlMessageType::MaxSubscribeId as u64 => {
                ControlMessage::MaxSubscribeId(MaxSubscribeId::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribesBlocked as u64 => {
                ControlMessage::SubscribesBlocked(SubscribesBlocked::decode(&mut data)?)
            }
            val if val == ControlMessageType::Subscribe as u64 => {
                ControlMessage::Subscribe(Subscribe::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeOk as u64 => {
                ControlMessage::SubscribeOk(SubscribeOk::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeError as u64 => {
                ControlMessage::SubscribeError(SubscribeError::decode(&mut data)?)
            }
            val if val == ControlMessageType::Unsubscribe as u64 => {
                ControlMessage::Unsubscribe(Unsubscribe::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeUpdate as u64 => {
                ControlMessage::SubscribeUpdate(SubscribeUpdate::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeDone as u64 => {
                ControlMessage::SubscribeDone(SubscribeDone::decode(&mut data)?)
            }
            val if val == ControlMessageType::Fetch as u64 => {
                ControlMessage::Fetch(Fetch::decode(&mut data)?)
            }
            val if val == ControlMessageType::FetchOk as u64 => {
                ControlMessage::FetchOk(FetchOk::decode(&mut data)?)
            }
            val if val == ControlMessageType::FetchError as u64 => {
                ControlMessage::FetchError(FetchError::decode(&mut data)?)
            }
            val if val == ControlMessageType::FetchCancel as u64 => {
                ControlMessage::FetchCancel(FetchCancel::decode(&mut data)?)
            }
            val if val == ControlMessageType::TrackStatusRequest as u64 => {
                ControlMessage::TrackStatusRequest(TrackStatusRequest::decode(&mut data)?)
            }
            val if val == ControlMessageType::TrackStatus as u64 => {
                ControlMessage::TrackStatus(TrackStatus::decode(&mut data)?)
            }
            val if val == ControlMessageType::Announce as u64 => {
                ControlMessage::Announce(Announce::decode(&mut data)?)
            }
            val if val == ControlMessageType::AnnounceOk as u64 => {
                ControlMessage::AnnounceOk(AnnounceOk::decode(&mut data)?)
            }
            val if val == ControlMessageType::AnnounceError as u64 => {
                ControlMessage::AnnounceError(AnnounceError::decode(&mut data)?)
            }
            val if val == ControlMessageType::Unannounce as u64 => {
                ControlMessage::Unannounce(Unannounce::decode(&mut data)?)
            }
            val if val == ControlMessageType::AnnounceCancel as u64 => {
                ControlMessage::AnnounceCancel(AnnounceCancel::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeAnnounces as u64 => {
                ControlMessage::SubscribeAnnounces(SubscribeAnnounces::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeAnnouncesOk as u64 => {
                ControlMessage::SubscribeAnnouncesOk(SubscribeAnnouncesOk::decode(&mut data)?)
            }
            val if val == ControlMessageType::SubscribeAnnouncesError as u64 => {
                ControlMessage::SubscribeAnnouncesError(SubscribeAnnouncesError::decode(&mut data)?)
            }
            val if val == ControlMessageType::UnsubscribeAnnounces as u64 => {
                ControlMessage::UnsubscribeAnnounces(UnsubscribeAnnounces::decode(&mut data)?)
            }
            _ => return Err(crate::coding::Error::UnknownMessageType(msg_type)),
        };

        if data.has_remaining() {
            return Err(crate::coding::Error::MessageLengthMismatch);
        }

        Ok(msg)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coding::{Encode, VarInt};
    use bytes::{Buf, BufMut};

    #[test]
    fn control_message_roundtrip() {
        let msg = ControlMessage::GoAway(GoAway {
            new_session_uri: "moq://example".to_string(),
        });
        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = ControlMessage::decode(&mut bytes).unwrap();

        match decoded {
            ControlMessage::GoAway(g) => assert_eq!(g.new_session_uri, "moq://example"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn message_length_mismatch() {
        let inner = GoAway {
            new_session_uri: "moq://example".to_string(),
        };
        let mut payload = bytes::BytesMut::new();
        inner.encode(&mut payload);
        let mut buf = bytes::BytesMut::new();
        VarInt(ControlMessageType::GoAway as u64).encode(&mut buf);
        // declare a length larger than actual and pad extra bytes
        VarInt((payload.len() + 2) as u64).encode(&mut buf);
        buf.put_slice(&payload);
        buf.put_slice(&[0u8; 2]);

        let mut bytes = buf.freeze();
        let res = ControlMessage::decode(&mut bytes);
        assert!(matches!(
            res,
            Err(crate::coding::Error::MessageLengthMismatch)
        ));
    }
}
