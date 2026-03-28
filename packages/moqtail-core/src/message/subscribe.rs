use crate::coding::{Decode, Encode, VarInt};
use crate::model::{
    GroupOrder, Parameter, SubscribeFilter, TrackAlias, TrackName, TrackNamespace,
    decode_track_name, decode_track_namespace, encode_track_name, encode_track_namespace,
};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone)]
pub struct Subscribe {
    pub subscribe_id: VarInt,
    pub track_alias: TrackAlias,
    pub track_namespace: TrackNamespace,
    pub track_name: TrackName,
    pub subscriber_priority: u8,
    pub group_order: GroupOrder,
    pub filter_type: SubscribeFilter,
    pub start_group: Option<VarInt>,
    pub start_object: Option<VarInt>,
    pub end_group: Option<VarInt>,
    pub parameters: Vec<Parameter>,
}

impl Encode for Subscribe {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.track_alias.encode(buf);
        encode_track_namespace(&self.track_namespace, buf);
        encode_track_name(&self.track_name, buf);
        buf.put_u8(self.subscriber_priority);
        buf.put_u8(self.group_order.into());
        VarInt::from(self.filter_type).encode(buf);
        if matches!(
            self.filter_type,
            SubscribeFilter::AbsoluteStart | SubscribeFilter::AbsoluteRange
        ) {
            if let Some(g) = self.start_group {
                g.encode(buf);
            } else {
                VarInt(0).encode(buf);
            }
            if let Some(o) = self.start_object {
                o.encode(buf);
            } else {
                VarInt(0).encode(buf);
            }
        }
        if matches!(self.filter_type, SubscribeFilter::AbsoluteRange) {
            if let Some(g) = self.end_group {
                g.encode(buf);
            } else {
                VarInt(0).encode(buf);
            }
        }
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for Subscribe {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        let track_alias = VarInt::decode(buf)?;

        let track_namespace = decode_track_namespace(buf)?;

        let track_name = decode_track_name(buf)?;

        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let subscriber_priority = buf.get_u8();

        if !buf.has_remaining() {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let group_order = GroupOrder::from(buf.get_u8());

        let filter_type = SubscribeFilter::from(VarInt::decode(buf)?);

        let (start_group, start_object) = if matches!(
            filter_type,
            SubscribeFilter::AbsoluteStart | SubscribeFilter::AbsoluteRange
        ) {
            (Some(VarInt::decode(buf)?), Some(VarInt::decode(buf)?))
        } else {
            (None, None)
        };

        let end_group = if matches!(filter_type, SubscribeFilter::AbsoluteRange) {
            Some(VarInt::decode(buf)?)
        } else {
            None
        };

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(Subscribe {
            subscribe_id,
            track_alias,
            track_namespace,
            track_name,
            subscriber_priority,
            group_order,
            filter_type,
            start_group,
            start_object,
            end_group,
            parameters,
        })
    }
}
