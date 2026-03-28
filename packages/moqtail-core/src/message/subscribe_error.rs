use crate::coding::{Decode, Encode, VarInt};
use crate::model::TrackAlias;
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeError {
    pub subscribe_id: VarInt,
    pub error_code: VarInt,
    pub reason_phrase: String,
    pub track_alias: TrackAlias,
}

impl Encode for SubscribeError {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.error_code.encode(buf);
        VarInt(self.reason_phrase.as_bytes().len() as u64).encode(buf);
        buf.put_slice(self.reason_phrase.as_bytes());
        self.track_alias.encode(buf);
    }
}

impl<'a> Decode<'a> for SubscribeError {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        let error_code = VarInt::decode(buf)?;

        let len = VarInt::decode(buf)?.into_inner() as usize;
        if buf.remaining() < len {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let bytes = buf.copy_to_bytes(len);
        let reason_phrase = std::str::from_utf8(&bytes)
            .map_err(|_| crate::coding::Error::UnexpectedEnd)?
            .to_string();

        let track_alias = VarInt::decode(buf)?;

        Ok(SubscribeError {
            subscribe_id,
            error_code,
            reason_phrase,
            track_alias,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeError {
            subscribe_id: VarInt(10),
            error_code: VarInt(2),
            reason_phrase: "timeout".to_string(),
            track_alias: VarInt(1),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeError::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
