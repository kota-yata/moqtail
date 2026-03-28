use crate::coding::{Decode, Encode, Error, VarInt};
use bytes::{Buf, BufMut};

pub type TrackNamespace = Vec<bytes::Bytes>;

pub type TrackName = bytes::Bytes;

pub type TrackAlias = VarInt;

pub fn encode_track_namespace<B: BufMut>(ns: &TrackNamespace, buf: &mut B) {
    assert!(
        !ns.is_empty() && ns.len() <= 32,
        "invalid track namespace length: {}",
        ns.len()
    );
    VarInt(ns.len() as u64).encode(buf);
    for part in ns {
        VarInt(part.len() as u64).encode(buf);
        buf.put_slice(part);
    }
}

pub fn decode_track_namespace<B: Buf>(buf: &mut B) -> Result<TrackNamespace, Error> {
    let len = VarInt::decode(buf)?.into_inner() as usize;
    if len == 0 || len > 32 {
        return Err(Error::InvalidTrackNamespaceLength(len as u64));
    }
    let mut ns = Vec::with_capacity(len);
    for _ in 0..len {
        let l = VarInt::decode(buf)?.into_inner() as usize;
        if buf.remaining() < l {
            return Err(Error::UnexpectedEnd);
        }
        let bytes = buf.copy_to_bytes(l);
        ns.push(bytes);
    }
    Ok(ns)
}

pub fn encode_track_name<B: BufMut>(name: &TrackName, buf: &mut B) {
    VarInt(name.len() as u64).encode(buf);
    buf.put_slice(name);
}

pub fn decode_track_name<B: Buf>(buf: &mut B) -> Result<TrackName, Error> {
    let len = VarInt::decode(buf)?.into_inner() as usize;
    if buf.remaining() < len {
        return Err(Error::UnexpectedEnd);
    }
    Ok(buf.copy_to_bytes(len))
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FullTrackName {
    pub namespace: TrackNamespace,
    pub name: TrackName,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ObjectId {
    pub group: VarInt,
    pub object: VarInt,
}

#[derive(Debug, Clone)]
pub struct Object {
    pub track_alias: TrackAlias,
    pub id: ObjectId,
    pub publisher_priority: u8,
    pub payload: bytes::Bytes,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SetupParameter {
    Path(String),
    MaxSubscribeId(VarInt),
    Unknown { ty: VarInt, value: bytes::Bytes },
}

impl crate::coding::Encode for SetupParameter {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        match self {
            SetupParameter::Path(path) => {
                VarInt(1).encode(buf);
                VarInt(path.as_bytes().len() as u64).encode(buf);
                buf.put_slice(path.as_bytes());
            }
            SetupParameter::MaxSubscribeId(id) => {
                VarInt(2).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                id.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put_slice(&tmp);
            }
            SetupParameter::Unknown { ty, value } => {
                ty.encode(buf);
                VarInt(value.len() as u64).encode(buf);
                buf.put_slice(value);
            }
        }
    }
}

impl<'a> crate::coding::Decode<'a> for SetupParameter {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let ty = VarInt::decode(buf)?;
        match ty.into_inner() {
            0x01 => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let bytes = buf.copy_to_bytes(len);
                let path = std::str::from_utf8(&bytes)
                    .map_err(|_| crate::coding::Error::UnexpectedEnd)?
                    .to_string();
                Ok(SetupParameter::Path(path))
            }
            0x02 => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let mut tmp = buf.copy_to_bytes(len);
                let val = match VarInt::decode(&mut tmp) {
                    Ok(v) => v,
                    Err(crate::coding::Error::UnexpectedEnd) => {
                        return Err(crate::coding::Error::ParameterLengthMismatch);
                    }
                    Err(e) => return Err(e),
                };
                if tmp.has_remaining() {
                    return Err(crate::coding::Error::ParameterLengthMismatch);
                }
                Ok(SetupParameter::MaxSubscribeId(val))
            }
            _ => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let bytes = buf.copy_to_bytes(len);
                Ok(SetupParameter::Unknown { ty, value: bytes })
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Parameter {
    AuthorizationInfo(String),
    DeliveryTimeout(VarInt),
    MaxCacheDuration(VarInt),
    Unknown { ty: VarInt, value: bytes::Bytes },
}

impl crate::coding::Encode for Parameter {
    fn encode<B: bytes::BufMut>(&self, buf: &mut B) {
        match self {
            Parameter::AuthorizationInfo(info) => {
                VarInt(0x02).encode(buf);
                VarInt(info.as_bytes().len() as u64).encode(buf);
                buf.put_slice(info.as_bytes());
            }
            Parameter::DeliveryTimeout(v) => {
                VarInt(0x03).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                v.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put_slice(&tmp);
            }
            Parameter::MaxCacheDuration(v) => {
                VarInt(0x04).encode(buf);
                let mut tmp = bytes::BytesMut::new();
                v.encode(&mut tmp);
                VarInt(tmp.len() as u64).encode(buf);
                buf.put_slice(&tmp);
            }
            Parameter::Unknown { ty, value } => {
                ty.encode(buf);
                VarInt(value.len() as u64).encode(buf);
                buf.put_slice(value);
            }
        }
    }
}

impl<'a> crate::coding::Decode<'a> for Parameter {
    fn decode<B: bytes::Buf>(buf: &mut B) -> Result<Self, crate::coding::Error> {
        let ty = VarInt::decode(buf)?;
        match ty.into_inner() {
            0x02 => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let bytes = buf.copy_to_bytes(len);
                let info = std::str::from_utf8(&bytes)
                    .map_err(|_| crate::coding::Error::UnexpectedEnd)?
                    .to_string();
                Ok(Parameter::AuthorizationInfo(info))
            }
            0x03 => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let mut tmp = buf.copy_to_bytes(len);
                let v = match VarInt::decode(&mut tmp) {
                    Ok(v) => v,
                    Err(crate::coding::Error::UnexpectedEnd) => {
                        return Err(crate::coding::Error::ParameterLengthMismatch);
                    }
                    Err(e) => return Err(e),
                };
                if tmp.has_remaining() {
                    return Err(crate::coding::Error::ParameterLengthMismatch);
                }
                Ok(Parameter::DeliveryTimeout(v))
            }
            0x04 => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let mut tmp = buf.copy_to_bytes(len);
                let v = match VarInt::decode(&mut tmp) {
                    Ok(v) => v,
                    Err(crate::coding::Error::UnexpectedEnd) => {
                        return Err(crate::coding::Error::ParameterLengthMismatch);
                    }
                    Err(e) => return Err(e),
                };
                if tmp.has_remaining() {
                    return Err(crate::coding::Error::ParameterLengthMismatch);
                }
                Ok(Parameter::MaxCacheDuration(v))
            }
            _ => {
                let len = VarInt::decode(buf)?.into_inner() as usize;
                if buf.remaining() < len {
                    return Err(crate::coding::Error::UnexpectedEnd);
                }
                let bytes = buf.copy_to_bytes(len);
                Ok(Parameter::Unknown { ty, value: bytes })
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupOrder {
    Publisher = 0x0,
    Ascending = 0x1,
    Descending = 0x2,
}

impl From<u8> for GroupOrder {
    fn from(v: u8) -> Self {
        match v {
            0x1 => GroupOrder::Ascending,
            0x2 => GroupOrder::Descending,
            _ => GroupOrder::Publisher,
        }
    }
}

impl From<GroupOrder> for u8 {
    fn from(v: GroupOrder) -> Self {
        v as u8
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscribeFilter {
    LatestObject = 0x2,
    AbsoluteStart = 0x3,
    AbsoluteRange = 0x4,
}

impl From<VarInt> for SubscribeFilter {
    fn from(v: VarInt) -> Self {
        match v.into_inner() {
            0x3 => SubscribeFilter::AbsoluteStart,
            0x4 => SubscribeFilter::AbsoluteRange,
            _ => SubscribeFilter::LatestObject,
        }
    }
}

impl From<SubscribeFilter> for VarInt {
    fn from(f: SubscribeFilter) -> Self {
        VarInt(f as u64)
    }
}

// -----------------------------------------------------------------------------
// Object data model
// -----------------------------------------------------------------------------

/// Error type for object model operations.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ModelError {
    #[error("object IDs must be added in increasing order")]
    ObjectIdOutOfOrder,
    #[error("subgroup already exists")]
    SubgroupExists,
    #[error("group already exists")]
    GroupExists,
}

use std::collections::BTreeMap;

/// A Subgroup is an ordered collection of objects from the same group.
#[derive(Debug, Clone)]
pub struct Subgroup {
    pub id: VarInt,
    objects: BTreeMap<VarInt, Object>,
}

impl Subgroup {
    pub fn new(id: VarInt) -> Self {
        Self {
            id,
            objects: BTreeMap::new(),
        }
    }

    /// Insert an object in ascending order by object id.
    pub fn add_object(&mut self, object: Object) -> Result<(), ModelError> {
        if let Some((&last, _)) = self.objects.iter().next_back() {
            if object.id.object <= last {
                return Err(ModelError::ObjectIdOutOfOrder);
            }
        }
        self.objects.insert(object.id.object, object);
        Ok(())
    }

    pub fn get_object(&self, id: VarInt) -> Option<&Object> {
        self.objects.get(&id)
    }
}

/// A Group contains multiple subgroups.
#[derive(Debug, Clone)]
pub struct Group {
    pub id: VarInt,
    subgroups: BTreeMap<VarInt, Subgroup>,
}

impl Group {
    pub fn new(id: VarInt) -> Self {
        Self {
            id,
            subgroups: BTreeMap::new(),
        }
    }

    pub fn add_subgroup(&mut self, subgroup_id: VarInt) -> Result<(), ModelError> {
        if self.subgroups.contains_key(&subgroup_id) {
            return Err(ModelError::SubgroupExists);
        }
        self.subgroups
            .insert(subgroup_id, Subgroup::new(subgroup_id));
        Ok(())
    }

    pub fn subgroup_mut(&mut self, id: VarInt) -> Option<&mut Subgroup> {
        self.subgroups.get_mut(&id)
    }

    pub fn subgroup(&self, id: VarInt) -> Option<&Subgroup> {
        self.subgroups.get(&id)
    }
}

/// A Track is identified by a namespace and name and contains groups.
#[derive(Debug, Clone)]
pub struct Track {
    pub full_name: FullTrackName,
    groups: BTreeMap<VarInt, Group>,
}

impl Track {
    pub fn new(full_name: FullTrackName) -> Self {
        Self {
            full_name,
            groups: BTreeMap::new(),
        }
    }

    pub fn add_group(&mut self, group_id: VarInt) -> Result<(), ModelError> {
        if self.groups.contains_key(&group_id) {
            return Err(ModelError::GroupExists);
        }
        self.groups.insert(group_id, Group::new(group_id));
        Ok(())
    }

    pub fn group_mut(&mut self, id: VarInt) -> Option<&mut Group> {
        self.groups.get_mut(&id)
    }

    pub fn group(&self, id: VarInt) -> Option<&Group> {
        self.groups.get(&id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::{Buf, BufMut};

    #[test]
    fn track_namespace_roundtrip() {
        let ns = vec![
            bytes::Bytes::from_static(b"foo"),
            bytes::Bytes::from_static(b"bar"),
        ];
        let mut buf = bytes::BytesMut::new();
        encode_track_namespace(&ns, &mut buf);
        let mut bytes = buf.freeze();
        let decoded = decode_track_namespace(&mut bytes).unwrap();
        assert_eq!(decoded, ns);
        assert!(!bytes.has_remaining());
    }

    #[test]
    fn track_namespace_invalid_length() {
        let mut buf = bytes::Bytes::from_static(&[0]);
        let res = decode_track_namespace(&mut buf);
        assert!(matches!(res, Err(Error::InvalidTrackNamespaceLength(0))));

        let mut buf = bytes::BytesMut::new();
        VarInt(33).encode(&mut buf);
        let mut bytes = buf.freeze();
        let res = decode_track_namespace(&mut bytes);
        assert!(matches!(res, Err(Error::InvalidTrackNamespaceLength(33))));
    }

    #[test]
    #[should_panic]
    fn encode_track_namespace_empty() {
        let ns: TrackNamespace = Vec::new();
        let mut buf = bytes::BytesMut::new();
        encode_track_namespace(&ns, &mut buf);
    }

    #[test]
    #[should_panic]
    fn encode_track_namespace_too_long() {
        let ns: TrackNamespace = (0..33).map(|_| bytes::Bytes::from_static(b"a")).collect();
        let mut buf = bytes::BytesMut::new();
        encode_track_namespace(&ns, &mut buf);
    }

    #[test]
    fn track_name_roundtrip() {
        let name = bytes::Bytes::from_static(b"video");
        let mut buf = bytes::BytesMut::new();
        encode_track_name(&name, &mut buf);
        let mut bytes = buf.freeze();
        let decoded = decode_track_name(&mut bytes).unwrap();
        assert_eq!(decoded, name);
        assert!(!bytes.has_remaining());
    }

    #[test]
    fn parameter_length_mismatch() {
        // DeliveryTimeout with incorrect length
        let mut buf = bytes::BytesMut::new();
        // type 0x03
        VarInt(0x03).encode(&mut buf);
        // declare length 1 but encode a two-byte varint value
        VarInt(1).encode(&mut buf);
        VarInt(1000).encode(&mut buf);
        let mut bytes = buf.freeze();
        let res = Parameter::decode(&mut bytes);
        assert!(matches!(res, Err(Error::ParameterLengthMismatch)));
    }

    #[test]
    fn setup_parameter_length_mismatch() {
        let mut buf = bytes::BytesMut::new();
        // type 0x02
        VarInt(0x02).encode(&mut buf);
        // declare length 1 but encode varint using two bytes
        VarInt(1).encode(&mut buf);
        VarInt(300).encode(&mut buf);
        let mut bytes = buf.freeze();
        let res = SetupParameter::decode(&mut bytes);
        assert!(matches!(res, Err(Error::ParameterLengthMismatch)));
    }

    #[test]
    fn subgroup_object_order() {
        let mut sg = Subgroup::new(VarInt(0));
        let obj1 = Object {
            track_alias: VarInt(1),
            id: ObjectId {
                group: VarInt(0),
                object: VarInt(1),
            },
            publisher_priority: 0,
            payload: bytes::Bytes::from_static(b"a"),
        };
        assert!(sg.add_object(obj1.clone()).is_ok());

        let obj2 = Object {
            track_alias: obj1.track_alias,
            id: ObjectId {
                group: VarInt(0),
                object: VarInt(0),
            },
            publisher_priority: obj1.publisher_priority,
            payload: obj1.payload.clone(),
        };
        let res = sg.add_object(obj2);
        assert!(matches!(res, Err(ModelError::ObjectIdOutOfOrder)));
        assert_eq!(sg.get_object(VarInt(1)).unwrap().payload, obj1.payload);
    }

    #[test]
    fn track_hierarchy() {
        let full = FullTrackName {
            namespace: vec![bytes::Bytes::from_static(b"ns")],
            name: bytes::Bytes::from_static(b"name"),
        };
        let mut track = Track::new(full);
        assert!(track.add_group(VarInt(1)).is_ok());
        assert!(track.add_group(VarInt(1)).is_err());
        let group = track.group_mut(VarInt(1)).unwrap();
        assert!(group.add_subgroup(VarInt(0)).is_ok());
        let sg = group.subgroup_mut(VarInt(0)).unwrap();
        let obj = Object {
            track_alias: VarInt(1),
            id: ObjectId {
                group: VarInt(1),
                object: VarInt(0),
            },
            publisher_priority: 0,
            payload: bytes::Bytes::from_static(b"p"),
        };
        assert!(sg.add_object(obj).is_ok());
    }
}
