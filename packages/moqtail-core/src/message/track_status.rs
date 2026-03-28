use crate::coding::{Decode, Encode, VarInt};
use crate::model::{
    TrackName, TrackNamespace, decode_track_name, decode_track_namespace, encode_track_name,
    encode_track_namespace,
};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackStatus {
    pub track_namespace: TrackNamespace,
    pub track_name: TrackName,
    pub status_code: VarInt,
    pub last_group_id: VarInt,
    pub last_object_id: VarInt,
}

impl Encode for TrackStatus {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace, buf);
        encode_track_name(&self.track_name, buf);
        self.status_code.encode(buf);
        self.last_group_id.encode(buf);
        self.last_object_id.encode(buf);
    }
}

impl<'a> Decode<'a> for TrackStatus {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace = decode_track_namespace(buf)?;

        let track_name = decode_track_name(buf)?;

        let status_code = VarInt::decode(buf)?;
        let last_group_id = VarInt::decode(buf)?;
        let last_object_id = VarInt::decode(buf)?;

        Ok(TrackStatus {
            track_namespace,
            track_name,
            status_code,
            last_group_id,
            last_object_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = TrackStatus {
            track_namespace: vec![
                bytes::Bytes::from_static(b"ns1"),
                bytes::Bytes::from_static(b"ns2"),
            ],
            track_name: bytes::Bytes::from_static(b"track"),
            status_code: VarInt(0),
            last_group_id: VarInt(1),
            last_object_id: VarInt(2),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = TrackStatus::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
