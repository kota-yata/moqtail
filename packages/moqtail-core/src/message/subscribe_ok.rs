use crate::coding::{Decode, Encode, VarInt};
use crate::model::{GroupOrder, Parameter};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeOk {
    pub subscribe_id: VarInt,
    pub expires: VarInt,
    pub group_order: GroupOrder,
    pub content_exists: bool,
    pub largest_group_id: Option<VarInt>,
    pub largest_object_id: Option<VarInt>,
    pub parameters: Vec<Parameter>,
}

impl Encode for SubscribeOk {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.expires.encode(buf);
        buf.put_u8(self.group_order.into());
        buf.put_u8(if self.content_exists { 1 } else { 0 });
        if self.content_exists {
            if let Some(g) = self.largest_group_id {
                g.encode(buf);
            }
            if let Some(o) = self.largest_object_id {
                o.encode(buf);
            }
        }
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for SubscribeOk {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        let expires = VarInt::decode(buf)?;
        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let group_order = GroupOrder::from(buf.get_u8());
        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let content_exists_byte = buf.get_u8();
        let content_exists = content_exists_byte == 1;
        let largest_group_id = if content_exists {
            Some(VarInt::decode(buf)?)
        } else {
            None
        };
        let largest_object_id = if content_exists {
            Some(VarInt::decode(buf)?)
        } else {
            None
        };
        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(Self {
            subscribe_id,
            expires,
            group_order,
            content_exists,
            largest_group_id,
            largest_object_id,
            parameters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeOk {
            subscribe_id: VarInt(1),
            expires: VarInt(0),
            group_order: GroupOrder::Ascending,
            content_exists: true,
            largest_group_id: Some(VarInt(5)),
            largest_object_id: Some(VarInt(10)),
            parameters: vec![Parameter::DeliveryTimeout(VarInt(10))],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeOk::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
