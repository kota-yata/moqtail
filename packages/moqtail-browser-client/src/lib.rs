use wasm_bindgen::prelude::*;
use moqtail_wasm::{self, WasmTransport, WasmConnection};
use moqtail_core::session::{Session, SessionCloseCode, MoqTransport};
use moqtail_core::model::{TrackNamespace, TrackName};
use bytes::Bytes;

// Re-export the panic hook initializer from moqtail-wasm so JavaScript can call it.
#[wasm_bindgen]
pub fn init_panic_hook() {
    moqtail_wasm::init_panic_hook();
}

fn js_err<E: core::fmt::Debug>(e: E) -> JsValue {
    JsValue::from_str(&format!("{:?}", e))
}

#[wasm_bindgen]
pub struct MoqtClient {
    session: Session<WasmConnection>,
}

#[wasm_bindgen]
impl MoqtClient {
    #[wasm_bindgen(constructor)]
    pub async fn new(url: String) -> Result<MoqtClient, JsValue> {
        let transport = WasmTransport::new();
        let conn = transport.connect(&url).await.map_err(js_err)?;
        let session = Session::new_client(conn, None).await.map_err(js_err)?;
        Ok(MoqtClient { session })
    }

    pub async fn subscribe(&mut self, namespace: String, name: String) -> Result<(), JsValue> {
        let ns: TrackNamespace = namespace
            .split('/')
            .filter(|s| !s.is_empty())
            .map(|s| Bytes::from(s.to_string()))
            .collect();
        let tn: TrackName = Bytes::from(name);
        self.session.subscribe(ns, tn).await.map_err(js_err)
    }

    pub async fn close(&mut self) -> Result<(), JsValue> {
        self.session
            .close(SessionCloseCode::NoError, "closing")
            .await
            .map_err(js_err)
    }
}
