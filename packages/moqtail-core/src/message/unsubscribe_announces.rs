use crate::coding::{Decode, Encode, VarInt};
use crate::model::{TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnsubscribeAnnounces {
    pub track_namespace_prefix: TrackNamespace,
}

impl Encode for UnsubscribeAnnounces {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace_prefix, buf);
    }
}

impl<'a> Decode<'a> for UnsubscribeAnnounces {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace_prefix = decode_track_namespace(buf)?;

        Ok(UnsubscribeAnnounces {
            track_namespace_prefix,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = UnsubscribeAnnounces {
            track_namespace_prefix: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = UnsubscribeAnnounces::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
