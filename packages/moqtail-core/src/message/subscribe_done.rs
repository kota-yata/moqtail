use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscribeDone {
    pub subscribe_id: VarInt,
    pub status_code: VarInt,
    pub stream_count: VarInt,
    pub reason_phrase: String,
}

impl Encode for SubscribeDone {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.subscribe_id.encode(buf);
        self.status_code.encode(buf);
        self.stream_count.encode(buf);
        VarInt(self.reason_phrase.as_bytes().len() as u64).encode(buf);
        buf.put_slice(self.reason_phrase.as_bytes());
    }
}

impl<'a> Decode<'a> for SubscribeDone {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let subscribe_id = VarInt::decode(buf)?;
        let status_code = VarInt::decode(buf)?;
        let stream_count = VarInt::decode(buf)?;
        let reason_len = VarInt::decode(buf)?.into_inner() as usize;
        if buf.remaining() < reason_len {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let bytes = buf.copy_to_bytes(reason_len);
        let reason_phrase = std::str::from_utf8(&bytes)
            .map_err(|_| crate::coding::Error::UnexpectedEnd)?
            .to_string();

        Ok(Self {
            subscribe_id,
            status_code,
            stream_count,
            reason_phrase,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = SubscribeDone {
            subscribe_id: VarInt(1),
            status_code: VarInt(5),
            stream_count: VarInt(1),
            reason_phrase: "test".to_string(),
        };

        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = SubscribeDone::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
