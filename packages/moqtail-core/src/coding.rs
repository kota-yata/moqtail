use bytes::{Buf, BufMut};
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("unexpected end of buffer")]
    UnexpectedEnd,
    #[error("unknown message type: {0}")]
    UnknownMessageType(VarInt),
    #[error("message length mismatch")]
    MessageLengthMismatch,
    #[error("parameter length mismatch")]
    ParameterLengthMismatch,
    #[error("invalid track namespace length: {0}")]
    InvalidTrackNamespaceLength(u64),
}

/// [Variable-Length Integer Encoding](https://datatracker.ietf.org/doc/html/rfc9000#name-variable-length-integer-enc)
#[derive(Default, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct VarInt(pub u64);

impl VarInt {
    pub fn into_inner(self) -> u64 {
        self.0
    }
}

impl From<u64> for VarInt {
    fn from(v: u64) -> Self {
        Self(v)
    }
}

impl fmt::Debug for VarInt {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}
impl fmt::Display for VarInt {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

pub trait Encode {
    fn encode<B: BufMut>(&self, buf: &mut B);
}

pub trait Decode<'a>: Sized {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, Error>;
}

impl Encode for VarInt {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        let val = self.0;
        if val < 2u64.pow(6) {
            buf.put_u8(val as u8);
        } else if val < 2u64.pow(14) {
            buf.put_u16(0b01 << 14 | val as u16);
        } else if val < 2u64.pow(30) {
            buf.put_u32(0b10 << 30 | val as u32);
        } else if val < 2u64.pow(62) {
            buf.put_u64(0b11 << 62 | val);
        } else {
            panic!("VarInt value too large");
        }
    }
}

impl<'a> Decode<'a> for VarInt {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, Error> {
        if !buf.has_remaining() {
            return Err(Error::UnexpectedEnd);
        }
        let first = buf.get_u8();
        let tag = first >> 6;
        let val = (first & 0x3f) as u64;

        Ok(Self(match tag {
            0b00 => val,
            0b01 => {
                if buf.remaining() < 1 {
                    return Err(Error::UnexpectedEnd);
                }
                (val << 8) | buf.get_u8() as u64
            }
            0b10 => {
                if buf.remaining() < 3 {
                    return Err(Error::UnexpectedEnd);
                }
                (val << 24) | buf.get_uint(3)
            }
            0b11 => {
                if buf.remaining() < 7 {
                    return Err(Error::UnexpectedEnd);
                }
                (val << 56) | buf.get_uint(7)
            }
            _ => unreachable!(),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::{Buf, BufMut};

    fn roundtrip(v: u64) {
        let vi = VarInt(v);
        let mut buf = bytes::BytesMut::new();
        vi.encode(&mut buf);
        let mut bytes = buf.freeze();
        let decoded = VarInt::decode(&mut bytes).unwrap();
        assert_eq!(decoded, vi);
        assert!(!bytes.has_remaining());
    }

    #[test]
    fn varint_encode_decode_roundtrip() {
        let values = [
            0,
            63,
            64,
            16383,
            16384,
            1_000_000,
            (1 << 30) - 1,
            1 << 30,
            (1 << 62) - 1,
        ];
        for &v in &values {
            roundtrip(v);
        }
    }

    #[test]
    fn decode_unexpected_end() {
        let mut buf = bytes::Bytes::from_static(&[0b01 << 6 | 0x3f]);
        let res = VarInt::decode(&mut buf);
        assert!(matches!(res, Err(Error::UnexpectedEnd)));
    }
}
