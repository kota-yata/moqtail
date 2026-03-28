use crate::coding::{Decode, Encode, VarInt};
use crate::model::{Parameter, TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Announce {
    pub track_namespace: TrackNamespace,
    pub parameters: Vec<Parameter>,
}

impl Encode for Announce {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace, buf);
        VarInt(self.parameters.len() as u64).encode(buf);
        for p in &self.parameters {
            p.encode(buf);
        }
    }
}

impl<'a> Decode<'a> for Announce {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace = decode_track_namespace(buf)?;

        let num_params = VarInt::decode(buf)?.into_inner() as usize;
        let mut parameters = Vec::with_capacity(num_params);
        for _ in 0..num_params {
            parameters.push(Parameter::decode(buf)?);
        }

        Ok(Self {
            track_namespace,
            parameters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = Announce {
            track_namespace: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
            parameters: vec![Parameter::AuthorizationInfo("auth".into())],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = Announce::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
