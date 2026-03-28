// Data stream types and serialization utilities for MOQT

use crate::coding::{Decode, Encode, Error, VarInt};
use crate::model::TrackAlias;
use bytes::{Buf, BufMut};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatagramType {
    Object = 0x1,
    ObjectStatus = 0x2,
}

impl From<VarInt> for DatagramType {
    fn from(v: VarInt) -> Self {
        match v.into_inner() {
            0x2 => DatagramType::ObjectStatus,
            _ => DatagramType::Object,
        }
    }
}

impl From<DatagramType> for VarInt {
    fn from(t: DatagramType) -> Self {
        VarInt(t as u64)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObjectStatus {
    Normal = 0x0,
    ObjectDoesNotExist = 0x1,
    GroupDoesNotExist = 0x2,
    EndOfGroup = 0x3,
    EndOfTrackAndGroup = 0x4,
    EndOfTrack = 0x5,
}

impl From<VarInt> for ObjectStatus {
    fn from(v: VarInt) -> Self {
        match v.into_inner() {
            0x1 => ObjectStatus::ObjectDoesNotExist,
            0x2 => ObjectStatus::GroupDoesNotExist,
            0x3 => ObjectStatus::EndOfGroup,
            0x4 => ObjectStatus::EndOfTrackAndGroup,
            0x5 => ObjectStatus::EndOfTrack,
            _ => ObjectStatus::Normal,
        }
    }
}

impl From<ObjectStatus> for VarInt {
    fn from(s: ObjectStatus) -> Self {
        VarInt(s as u64)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExtensionHeaderValue {
    VarInt(VarInt),
    Bytes(bytes::Bytes),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtensionHeader {
    pub id: VarInt,
    pub value: ExtensionHeaderValue,
}

impl Encode for ExtensionHeader {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.id.encode(buf);
        match &self.value {
            ExtensionHeaderValue::VarInt(v) => v.encode(buf),
            ExtensionHeaderValue::Bytes(b) => {
                VarInt(b.len() as u64).encode(buf);
                buf.put_slice(b);
            }
        }
    }
}

impl<'a> Decode<'a> for ExtensionHeader {
    fn decode<B: Buf>(buf: &mut B) -> Result<Self, Error> {
        let id = VarInt::decode(buf)?;
        let value = if id.0 % 2 == 0 {
            ExtensionHeaderValue::VarInt(VarInt::decode(buf)?)
        } else {
            let len = VarInt::decode(buf)?.into_inner() as usize;
            if buf.remaining() < len {
                return Err(Error::UnexpectedEnd);
            }
            ExtensionHeaderValue::Bytes(buf.copy_to_bytes(len))
        };
        Ok(ExtensionHeader { id, value })
    }
}

pub fn encode_extension_headers<B: BufMut>(headers: &[ExtensionHeader], buf: &mut B) {
    let mut tmp = bytes::BytesMut::new();
    for h in headers {
        h.encode(&mut tmp);
    }
    VarInt(tmp.len() as u64).encode(buf);
    buf.put(tmp);
}

pub fn decode_extension_headers<B: Buf>(buf: &mut B) -> Result<Vec<ExtensionHeader>, Error> {
    let len = VarInt::decode(buf)?.into_inner() as usize;
    if buf.remaining() < len {
        return Err(Error::UnexpectedEnd);
    }
    let mut data = buf.copy_to_bytes(len);
    let mut headers = Vec::new();
    while data.has_remaining() {
        headers.push(ExtensionHeader::decode(&mut data)?);
    }
    Ok(headers)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamType {
    SubgroupHeader = 0x4,
    FetchHeader = 0x5,
}

#[derive(Debug, Clone)]
pub struct SubgroupHeader {
    pub track_alias: TrackAlias,
    pub group_id: VarInt,
    pub subgroup_id: VarInt,
    pub publisher_priority: u8,
}

pub fn encode_subgroup_header<B: BufMut>(header: &SubgroupHeader, buf: &mut B) {
    VarInt(StreamType::SubgroupHeader as u64).encode(buf);
    header.track_alias.encode(buf);
    header.group_id.encode(buf);
    header.subgroup_id.encode(buf);
    buf.put_u8(header.publisher_priority);
}

pub fn decode_subgroup_header<B: Buf>(buf: &mut B) -> Result<SubgroupHeader, Error> {
    let track_alias = VarInt::decode(buf)?;
    let group_id = VarInt::decode(buf)?;
    let subgroup_id = VarInt::decode(buf)?;
    if !buf.has_remaining() {
        return Err(Error::UnexpectedEnd);
    }
    let publisher_priority = buf.get_u8();
    Ok(SubgroupHeader {
        track_alias,
        group_id,
        subgroup_id,
        publisher_priority,
    })
}

#[derive(Debug, Clone)]
pub struct SubgroupObject {
    pub object_id: VarInt,
    pub extension_headers: Vec<ExtensionHeader>,
    pub object_status: Option<ObjectStatus>,
    pub payload: bytes::Bytes,
}

impl Encode for SubgroupObject {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.object_id.encode(buf);
        encode_extension_headers(&self.extension_headers, buf);
        VarInt(self.payload.len() as u64).encode(buf);
        if self.payload.is_empty() {
            if let Some(status) = self.object_status {
                VarInt::from(status).encode(buf);
            }
        }
        buf.put_slice(&self.payload);
    }
}

#[derive(Debug, Clone)]
pub struct SubgroupObjectHeader {
    pub object_id: VarInt,
    pub extension_headers: Vec<ExtensionHeader>,
    pub object_status: Option<ObjectStatus>,
}

pub fn decode_subgroup_object_header<B: Buf>(buf: &mut B) -> Result<SubgroupObjectHeader, Error> {
    let object_id = VarInt::decode(buf)?;
    let extension_headers = decode_extension_headers(buf)?;
    let payload_len = VarInt::decode(buf)?.into_inner() as usize;
    let object_status = if payload_len == 0 {
        Some(ObjectStatus::from(VarInt::decode(buf)?))
    } else {
        None
    };
    Ok(SubgroupObjectHeader {
        object_id,
        extension_headers,
        object_status,
    })
}

#[derive(Debug, Clone)]
pub struct FetchHeader {
    pub subscribe_id: VarInt,
}

pub fn encode_fetch_header<B: BufMut>(header: &FetchHeader, buf: &mut B) {
    VarInt(StreamType::FetchHeader as u64).encode(buf);
    header.subscribe_id.encode(buf);
}

pub fn decode_fetch_header<B: Buf>(buf: &mut B) -> Result<FetchHeader, Error> {
    let subscribe_id = VarInt::decode(buf)?;
    Ok(FetchHeader { subscribe_id })
}

#[derive(Debug, Clone)]
pub struct FetchObject {
    pub group_id: VarInt,
    pub subgroup_id: VarInt,
    pub object_id: VarInt,
    pub publisher_priority: u8,
    pub extension_headers: Vec<ExtensionHeader>,
    pub object_status: Option<ObjectStatus>,
    pub payload: bytes::Bytes,
}

impl Encode for FetchObject {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        self.group_id.encode(buf);
        self.subgroup_id.encode(buf);
        self.object_id.encode(buf);
        buf.put_u8(self.publisher_priority);
        encode_extension_headers(&self.extension_headers, buf);
        VarInt(self.payload.len() as u64).encode(buf);
        if self.payload.is_empty() {
            if let Some(status) = self.object_status {
                VarInt::from(status).encode(buf);
            }
        }
        buf.put_slice(&self.payload);
    }
}

#[derive(Debug, Clone)]
pub struct FetchObjectHeader {
    pub group_id: VarInt,
    pub subgroup_id: VarInt,
    pub object_id: VarInt,
    pub publisher_priority: u8,
    pub extension_headers: Vec<ExtensionHeader>,
    pub object_status: Option<ObjectStatus>,
}

pub fn decode_fetch_object_header<B: Buf>(buf: &mut B) -> Result<FetchObjectHeader, Error> {
    let group_id = VarInt::decode(buf)?;
    let subgroup_id = VarInt::decode(buf)?;
    let object_id = VarInt::decode(buf)?;
    if !buf.has_remaining() {
        return Err(Error::UnexpectedEnd);
    }
    let publisher_priority = buf.get_u8();
    let extension_headers = decode_extension_headers(buf)?;
    let payload_len = VarInt::decode(buf)?.into_inner() as usize;
    let object_status = if payload_len == 0 {
        Some(ObjectStatus::from(VarInt::decode(buf)?))
    } else {
        None
    };
    Ok(FetchObjectHeader {
        group_id,
        subgroup_id,
        object_id,
        publisher_priority,
        extension_headers,
        object_status,
    })
}

#[derive(Debug, Clone)]
pub struct Datagram {
    pub track_alias: TrackAlias,
    pub group_id: VarInt,
    pub object_id: VarInt,
    pub publisher_priority: u8,
    pub extension_headers: Vec<ExtensionHeader>,
    pub payload: bytes::Bytes,
}

impl Encode for Datagram {
    fn encode<B: BufMut>(&self, buf: &mut B) {
        let dgram_type = if self.payload.is_empty() {
            DatagramType::ObjectStatus
        } else {
            DatagramType::Object
        };
        VarInt::from(dgram_type).encode(buf);
        self.track_alias.encode(buf);
        self.group_id.encode(buf);
        self.object_id.encode(buf);
        buf.put_u8(self.publisher_priority);
        encode_extension_headers(&self.extension_headers, buf);
        buf.put_slice(&self.payload);
    }
}

#[derive(Debug, Clone)]
pub struct DatagramHeader {
    pub track_alias: TrackAlias,
    pub group_id: VarInt,
    pub object_id: VarInt,
    pub publisher_priority: u8,
    pub extension_headers: Vec<ExtensionHeader>,
}

pub fn decode_datagram_header<B: Buf>(buf: &mut B) -> Result<DatagramHeader, Error> {
    let track_alias = VarInt::decode(buf)?;
    let group_id = VarInt::decode(buf)?;
    let object_id = VarInt::decode(buf)?;
    if !buf.has_remaining() {
        return Err(Error::UnexpectedEnd);
    }
    let publisher_priority = buf.get_u8();
    let extension_headers = decode_extension_headers(buf)?;
    Ok(DatagramHeader {
        track_alias,
        group_id,
        object_id,
        publisher_priority,
        extension_headers,
    })
}

pub fn decode_datagram<B: Buf>(
    buf: &mut B,
) -> Result<(DatagramType, DatagramHeader, bytes::Bytes), Error> {
    let dgram_type = DatagramType::from(VarInt::decode(buf)?);
    let header = decode_datagram_header(buf)?;
    let payload = buf.copy_to_bytes(buf.remaining());
    Ok((dgram_type, header, payload))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::{BufMut, BytesMut};

    #[test]
    fn extension_header_roundtrip() {
        let header = ExtensionHeader {
            id: VarInt(2),
            value: ExtensionHeaderValue::VarInt(VarInt(5)),
        };
        let mut buf = BytesMut::new();
        header.encode(&mut buf);
        let mut bytes = buf.freeze();
        let decoded = ExtensionHeader::decode(&mut bytes).unwrap();
        if let ExtensionHeaderValue::VarInt(v) = decoded.value {
            assert_eq!(v, VarInt(5));
        } else {
            panic!("wrong variant");
        }
        let mut multi = BytesMut::new();
        encode_extension_headers(&[header.clone()], &mut multi);
        assert!(multi.len() > 0);
    }

    #[test]
    fn datagram_header_roundtrip() {
        let dg = Datagram {
            track_alias: VarInt(1),
            group_id: VarInt(2),
            object_id: VarInt(3),
            publisher_priority: 4,
            extension_headers: Vec::new(),
            payload: BytesMut::from(&[5u8][..]).freeze(),
        };
        let mut buf = BytesMut::new();
        dg.encode(&mut buf);
        let encoded = buf.freeze();
        let mut header_bytes = encoded.slice(1..); // skip datagram type
        let header = decode_datagram_header(&mut header_bytes).unwrap();
        assert_eq!(header.track_alias, VarInt(1));
        assert_eq!(header.group_id, VarInt(2));
        assert_eq!(header.object_id, VarInt(3));
        assert_eq!(header.publisher_priority, 4);
    }

    #[test]
    fn subgroup_header_roundtrip() {
        let sg = SubgroupHeader {
            track_alias: VarInt(1),
            group_id: VarInt(2),
            subgroup_id: VarInt(3),
            publisher_priority: 4,
        };
        let mut buf = BytesMut::new();
        encode_subgroup_header(&sg, &mut buf);
        let encoded = buf.freeze();
        let mut header_bytes = encoded.slice(1..); // skip stream type
        let decoded = decode_subgroup_header(&mut header_bytes).unwrap();
        assert_eq!(decoded.track_alias, sg.track_alias);
        assert_eq!(decoded.group_id, sg.group_id);
        assert_eq!(decoded.subgroup_id, sg.subgroup_id);
        assert_eq!(decoded.publisher_priority, sg.publisher_priority);
    }

    #[test]
    fn subgroup_object_roundtrip() {
        let obj = SubgroupObject {
            object_id: VarInt(1),
            extension_headers: Vec::new(),
            object_status: None,
            payload: BytesMut::from(&[1u8][..]).freeze(),
        };
        let mut buf = BytesMut::new();
        obj.encode(&mut buf);
        let encoded = buf.freeze();
        let header_len = encoded.len() - obj.payload.len();
        let mut header_bytes = encoded.slice(..header_len);
        let header = decode_subgroup_object_header(&mut header_bytes).unwrap();
        assert_eq!(header.object_id, obj.object_id);
    }

    #[test]
    fn fetch_header_roundtrip() {
        let fh = FetchHeader {
            subscribe_id: VarInt(42),
        };
        let mut buf = BytesMut::new();
        encode_fetch_header(&fh, &mut buf);
        let encoded = buf.freeze();
        let mut header_bytes = encoded.slice(1..); // skip stream type
        let decoded = decode_fetch_header(&mut header_bytes).unwrap();
        assert_eq!(decoded.subscribe_id, fh.subscribe_id);
    }

    #[test]
    fn fetch_object_roundtrip() {
        let obj = FetchObject {
            group_id: VarInt(1),
            subgroup_id: VarInt(2),
            object_id: VarInt(3),
            publisher_priority: 4,
            extension_headers: Vec::new(),
            object_status: None,
            payload: BytesMut::from(&[1u8, 2u8][..]).freeze(),
        };
        let mut buf = BytesMut::new();
        obj.encode(&mut buf);
        let encoded = buf.freeze();
        let header_len = encoded.len() - obj.payload.len();
        let mut header_bytes = encoded.slice(..header_len);
        let header = decode_fetch_object_header(&mut header_bytes).unwrap();
        assert_eq!(header.group_id, obj.group_id);
        assert_eq!(header.subgroup_id, obj.subgroup_id);
        assert_eq!(header.object_id, obj.object_id);
        assert_eq!(header.publisher_priority, obj.publisher_priority);
    }

    #[test]
    fn datagram_roundtrip() {
        let dg = Datagram {
            track_alias: VarInt(1),
            group_id: VarInt(2),
            object_id: VarInt(3),
            publisher_priority: 4,
            extension_headers: Vec::new(),
            payload: BytesMut::from(&[9u8][..]).freeze(),
        };
        let mut buf = BytesMut::new();
        dg.encode(&mut buf);
        let mut bytes = buf.freeze();
        let (dgram_type, header, payload) = decode_datagram(&mut bytes).unwrap();
        assert_eq!(dgram_type, DatagramType::Object);
        assert_eq!(header.object_id, dg.object_id);
        assert_eq!(payload, dg.payload);
    }
}
