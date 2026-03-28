use crate::coding::{Decode, Encode, VarInt};
use crate::model::Parameter;
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeUpdate {
    pub subscribe_id: VarInt,
    pub start_group: VarInt,
    pub start_object: VarInt,
    pub end_group: VarInt,
    pub subscriber_priority: u8,
    pub parameters: Vec<Parameter>,
}

impl Encode for SubscribeUpdate {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.start_group.encode(buf);
        self.start_object.encode(buf);
        self.end_group.encode(buf);
        buf.put_u8(self.subscriber_priority);
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for SubscribeUpdate {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        let start_group = VarInt::decode(buf)?;
        let start_object = VarInt::decode(buf)?;
        let end_group = VarInt::decode(buf)?;

        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let subscriber_priority = buf.get_u8();

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(SubscribeUpdate {
            subscribe_id,
            start_group,
            start_object,
            end_group,
            subscriber_priority,
            parameters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeUpdate {
            subscribe_id: VarInt(1),
            start_group: VarInt(2),
            start_object: VarInt(3),
            end_group: VarInt(4),
            subscriber_priority: 5,
            parameters: vec![Parameter::AuthorizationInfo("auth".into())],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeUpdate::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
