use crate::coding::{Decode, Encode, VarInt};
use crate::model::{TrackNamespace, decode_track_namespace, encode_track_namespace};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeAnnouncesError {
    pub track_namespace_prefix: TrackNamespace,
    pub error_code: VarInt,
    pub reason_phrase: String,
}

impl Encode for SubscribeAnnouncesError {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        encode_track_namespace(&self.track_namespace_prefix, buf);
        self.error_code.encode(buf);
        VarInt(self.reason_phrase.as_bytes().len() as u64).encode(buf);
        buf.put_slice(self.reason_phrase.as_bytes());
    }
}

impl<'a> Decode<'a> for SubscribeAnnouncesError {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let track_namespace_prefix = decode_track_namespace(buf)?;

        let error_code = VarInt::decode(buf)?;

        let len = VarInt::decode(buf)?.into_inner() as usize;
        if buf.remaining() < len {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let bytes = buf.copy_to_bytes(len);
        let reason_phrase = std::str::from_utf8(&bytes)
            .map_err(|_| crate::coding::Error::UnexpectedEnd)?
            .to_string();

        Ok(SubscribeAnnouncesError {
            track_namespace_prefix,
            error_code,
            reason_phrase,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeAnnouncesError {
            track_namespace_prefix: vec![
                bytes::Bytes::from_static(b"a"),
                bytes::Bytes::from_static(b"b"),
            ],
            error_code: VarInt(1),
            reason_phrase: "err".to_string(),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeAnnouncesError::decode(&mut bytes).unwrap();

        assert_eq!(decoded, msg);
    }
}
