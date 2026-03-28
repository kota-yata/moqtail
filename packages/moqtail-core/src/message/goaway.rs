use crate::coding::{Decode, Encode, VarInt};
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoAway {
    pub new_session_uri: String,
}

impl Encode for GoAway {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        VarInt(self.new_session_uri.as_bytes().len() as u64).encode(buf);
        buf.put_slice(self.new_session_uri.as_bytes());
    }
}

impl<'a> Decode<'a> for GoAway {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let len = VarInt::decode(buf)?.into_inner() as usize;
        if buf.remaining() < len {
            return Err(crate::coding::Error::UnexpectedEnd);
        }
        let bytes = buf.copy_to_bytes(len);
        let uri = std::str::from_utf8(&bytes)
            .map_err(|_| crate::coding::Error::UnexpectedEnd)?
            .to_string();
        Ok(GoAway {
            new_session_uri: uri,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_decode_roundtrip() {
        let msg = GoAway {
            new_session_uri: "moq://example".to_string(),
        };
        let mut buf = bytes::BytesMut::new();
        msg.encode(&mut buf);

        let mut bytes = buf.freeze();
        let decoded = GoAway::decode(&mut bytes).unwrap();
        assert_eq!(decoded, msg);
    }
}
