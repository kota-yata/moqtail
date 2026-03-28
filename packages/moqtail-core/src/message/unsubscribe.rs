use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Unsubscribe {
    pub subscribe_id: VarInt,
}

impl Encode for Unsubscribe {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
    }
}

impl<'a> Decode<'a> for Unsubscribe {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        Ok(Unsubscribe { subscribe_id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = Unsubscribe {
            subscribe_id: VarInt(42),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = Unsubscribe::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
