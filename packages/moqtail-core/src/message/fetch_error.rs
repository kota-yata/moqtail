use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchError {
    pub subscribe_id: VarInt,
    pub error_code: VarInt,
    pub reason_phrase: String,
}

impl Encode for FetchError {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.error_code.encode(buf);
        VarInt(self.reason_phrase.as_bytes().len() as u64).encode(buf);
        buf.put_slice(self.reason_phrase.as_bytes());
    }
}

impl<'a> Decode<'a> for FetchError {
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

        Ok(Self {
            subscribe_id,
            error_code,
            reason_phrase,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = FetchError {
            subscribe_id: VarInt(10),
            error_code: VarInt(2),
            reason_phrase: "timeout".to_string(),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = FetchError::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
