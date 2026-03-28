use crate::coding::{Decode, Encode, VarInt};
use crate::model::{TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Unannounce {
    pub track_namespace: TrackNamespace,
}

impl Encode for Unannounce {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace, buf);
    }
}

impl<'a> Decode<'a> for Unannounce {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace = decode_track_namespace(buf)?;

        Ok(Unannounce { track_namespace })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = Unannounce {
            track_namespace: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = Unannounce::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
