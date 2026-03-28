use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MaxSubscribeId {
    pub subscribe_id: VarInt,
}

impl Encode for MaxSubscribeId {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
    }
}

impl<'a> Decode<'a> for MaxSubscribeId {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        Ok(Self { subscribe_id })
    }
}
