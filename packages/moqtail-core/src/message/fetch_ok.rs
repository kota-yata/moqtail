use crate::coding::{Decode, Encode, VarInt};
use crate::model::{GroupOrder, Parameter};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone)]
pub struct FetchOk {
    pub subscribe_id: VarInt,
    pub group_order: GroupOrder,
    pub end_of_track: bool,
    pub largest_group_id: VarInt,
    pub largest_object_id: VarInt,
    pub parameters: Vec<Parameter>,
}

impl Encode for FetchOk {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        buf.put_u8(self.group_order.into());
        buf.put_u8(self.end_of_track as u8);
        self.largest_group_id.encode(buf);
        self.largest_object_id.encode(buf);
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for FetchOk {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;

        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let group_order = GroupOrder::from(buf.get_u8());

        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let end_of_track = buf.get_u8() != 0;

        let largest_group_id = VarInt::decode(buf)?;
        let largest_object_id = VarInt::decode(buf)?;

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(FetchOk {
            subscribe_id,
            group_order,
            end_of_track,
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
        let msg = FetchOk {
            subscribe_id: VarInt(1),
            group_order: GroupOrder::Ascending,
            end_of_track: true,
            largest_group_id: VarInt(10),
            largest_object_id: VarInt(2),
            parameters: vec![Parameter::DeliveryTimeout(VarInt(5))],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = FetchOk::decode(&mut bytes).unwrap();

        assert_eq!(decoded.subscribe_id, msg.subscribe_id);
        assert_eq!(decoded.group_order as u8, msg.group_order as u8);
        assert_eq!(decoded.end_of_track, msg.end_of_track);
        assert_eq!(decoded.largest_group_id, msg.largest_group_id);
        assert_eq!(decoded.largest_object_id, msg.largest_object_id);
        assert_eq!(decoded.parameters.len(), msg.parameters.len());
        match &decoded.parameters[0] {
            Parameter::DeliveryTimeout(v) => assert_eq!(*v, VarInt(5)),
            _ => panic!("unexpected parameter"),
        }
    }
}
