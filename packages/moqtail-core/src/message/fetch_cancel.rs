use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FetchCancel {
    pub subscribe_id: VarInt,
}

impl Encode for FetchCancel {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
    }
}

impl<'a> Decode<'a> for FetchCancel {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        Ok(Self { subscribe_id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = FetchCancel {
            subscribe_id: VarInt(10),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = FetchCancel::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
