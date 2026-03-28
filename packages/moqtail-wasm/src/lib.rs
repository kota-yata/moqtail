use async_trait::async_trait;
use console_error_panic_hook;
use js_sys::Uint8Array;
use moqtail_core::session::{MoqConnection, MoqTransport, TransportEvent};
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use wasm_streams::readable::{IntoAsyncRead, ReadableStream};
use wasm_streams::writable::{IntoAsyncWrite, WritableStream};

#[derive(Debug, thiserror::Error)]
pub enum WasmError {
    #[error("JavaScript error: {0:?}")]
    Js(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<JsValue> for WasmError {
    fn from(v: JsValue) -> Self {
        Self::Js(format!("{:?}", v))
    }
}

pub struct WasmTransport;

impl WasmTransport {
    pub fn new() -> Self {
        Self
    }
}

pub struct WasmConnection {
    transport: web_sys::WebTransport,
}

pub struct WasmBiStream {
    reader: IntoAsyncRead<'static>,
    writer: IntoAsyncWrite<'static>,
}

impl futures::io::AsyncRead for WasmBiStream {
    fn poll_read(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut [u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        std::pin::Pin::new(&mut self.reader).poll_read(cx, buf)
    }
}

impl futures::io::AsyncWrite for WasmBiStream {
    fn poll_write(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        std::pin::Pin::new(&mut self.writer).poll_write(cx, buf)
    }

    fn poll_flush(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::pin::Pin::new(&mut self.writer).poll_flush(cx)
    }

    fn poll_close(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::pin::Pin::new(&mut self.writer).poll_close(cx)
    }
}

impl Unpin for WasmBiStream {}

#[async_trait(?Send)]
impl MoqTransport for WasmTransport {
    type Connection = WasmConnection;
    type Error = WasmError;

    async fn connect(&self, url: &str) -> Result<Self::Connection, Self::Error> {
        let transport = web_sys::WebTransport::new(url)?;
        JsFuture::from(transport.ready()).await?;
        Ok(WasmConnection { transport })
    }
}

#[async_trait(?Send)]
impl MoqConnection for WasmConnection {
    type BiStream = WasmBiStream;
    type UniStream = IntoAsyncWrite<'static>;
    type Datagram = bytes::Bytes;
    type Error = WasmError;

    async fn open_bi(&mut self) -> Result<Self::BiStream, Self::Error> {
        let stream = JsFuture::from(self.transport.create_bidirectional_stream()).await?;
        let bi_stream: web_sys::WebTransportBidirectionalStream = stream.dyn_into()?;

        let rs = ReadableStream::from_raw(bi_stream.readable().into()).into_async_read();
        let ws = WritableStream::from_raw(bi_stream.writable().into()).into_async_write();
        Ok(WasmBiStream {
            reader: rs,
            writer: ws,
        })
    }

    async fn open_uni(&mut self) -> Result<Self::UniStream, Self::Error> {
        let stream = JsFuture::from(self.transport.create_unidirectional_stream()).await?;
        let uni_stream: web_sys::WritableStream = stream.dyn_into()?;
        let ws = WritableStream::from_raw(uni_stream);
        Ok(ws.into_async_write())
    }

    async fn send_datagram(&mut self, data: &[u8]) -> Result<(), Self::Error> {
        let datagram_writer = self.transport.datagrams().writable().get_writer()?;
        let array = Uint8Array::from(data);
        JsFuture::from(datagram_writer.write_with_chunk(&array.into())).await?;
        datagram_writer.release_lock();
        Ok(())
    }

    async fn poll_event(
        &mut self,
    ) -> Result<TransportEvent<Self::BiStream, Self::UniStream, Self::Datagram>, Self::Error> {
        // WebTransport JavaScript API does not currently expose a unified polling
        // mechanism. For now we simply wait for the connection to be closed and
        // report the event to the caller.
        let _ = JsFuture::from(self.transport.closed()).await?;
        Ok(TransportEvent::ConnectionClosed)
    }

    async fn close(
        &mut self,
        code: moqtail_core::coding::VarInt,
        reason: &str,
    ) -> Result<(), Self::Error> {
        let _ = code;
        let _ = reason;
        // `WebTransport::close()` currently doesn't allow specifying a close code
        // without unstable APIs, so we call the basic variant.
        self.transport.close();
        Ok(())
    }
}

// ロギングやパニックフックを初期化するためのユーティリティ関数
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}
