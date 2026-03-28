use crate::coding::{Decode, Encode, VarInt};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SubscribesBlocked {
    pub maximum_subscribe_id: VarInt,
}

impl Encode for SubscribesBlocked {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        self.maximum_subscribe_id.encode(buf);
    }
}

impl<'a> Decode<'a> for SubscribesBlocked {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let maximum_subscribe_id = VarInt::decode(buf)?;
        Ok(Self {
            maximum_subscribe_id,
        })
    }
}
