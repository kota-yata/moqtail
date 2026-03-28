use crate::coding::{Decode, Encode, VarInt};
use crate::model::{
    TrackName, TrackNamespace, decode_track_name, decode_track_namespace, encode_track_name,
    encode_track_namespace,
};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackStatusRequest {
    pub track_namespace: TrackNamespace,
    pub track_name: TrackName,
}

impl Encode for TrackStatusRequest {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace, buf);
        encode_track_name(&self.track_name, buf);
    }
}

impl<'a> Decode<'a> for TrackStatusRequest {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace = decode_track_namespace(buf)?;

        let track_name = decode_track_name(buf)?;

        Ok(TrackStatusRequest {
            track_namespace,
            track_name,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = TrackStatusRequest {
            track_namespace: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
            track_name: bytes::Bytes::from_static(b"track"),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = TrackStatusRequest::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
