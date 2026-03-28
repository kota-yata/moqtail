use crate::coding::{Decode, Encode, VarInt};
use crate::model::{TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnnounceOk {
    pub track_namespace: TrackNamespace,
}

impl Encode for AnnounceOk {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace, buf);
    }
}

impl<'a> Decode<'a> for AnnounceOk {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace = decode_track_namespace(buf)?;

        Ok(AnnounceOk { track_namespace })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = AnnounceOk {
            track_namespace: vec![
                bytes::Bytes::from_static(b"live"),
                bytes::Bytes::from_static(b"video"),
            ],
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = AnnounceOk::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
