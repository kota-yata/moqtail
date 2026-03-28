use crate::coding::{Decode, Encode, VarInt};
use crate::model::{Parameter, TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeAnnounces {
    pub track_namespace_prefix: TrackNamespace,
    pub parameters: Vec<Parameter>,
}

impl Encode for SubscribeAnnounces {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace_prefix, buf);
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for SubscribeAnnounces {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace_prefix = decode_track_namespace(buf)?;

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(SubscribeAnnounces {
            track_namespace_prefix,
            parameters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeAnnounces {
            track_namespace_prefix: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
            parameters: vec![Parameter::AuthorizationInfo("auth".into())],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeAnnounces::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
