use bytes::Bytes;
use moqtail_core::coding::VarInt;
use moqtail_core::datastream::{ExtensionHeader, ExtensionHeaderValue};

/// LOC Header Extension definitions as per the LOC Streaming Format specification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LocHeaderExtension {
    /// Capture Timestamp in microseconds since Unix epoch.
    CaptureTimestamp(u64),
    /// Video decoder configuration extradata.
    VideoConfig(Bytes),
    /// Video Frame Marking flags encoded as a varint.
    VideoFrameMarking(u32),
    /// Audio Level encoded as a varint.
    AudioLevel(u16),
    /// Any extension that is not understood by this library.
    Unknown(ExtensionHeader),
}

impl From<LocHeaderExtension> for ExtensionHeader {
    fn from(ext: LocHeaderExtension) -> Self {
        match ext {
            LocHeaderExtension::CaptureTimestamp(ts) => ExtensionHeader {
                id: VarInt(2),
                value: ExtensionHeaderValue::VarInt(VarInt(ts as u64)),
            },
            LocHeaderExtension::VideoConfig(data) => ExtensionHeader {
                id: VarInt(13),
                value: ExtensionHeaderValue::Bytes(data),
            },
            LocHeaderExtension::VideoFrameMarking(v) => ExtensionHeader {
                id: VarInt(4),
                value: ExtensionHeaderValue::VarInt(VarInt(v as u64)),
            },
            LocHeaderExtension::AudioLevel(v) => ExtensionHeader {
                id: VarInt(6),
                value: ExtensionHeaderValue::VarInt(VarInt(v as u64)),
            },
            LocHeaderExtension::Unknown(h) => h,
        }
    }
}

impl From<ExtensionHeader> for LocHeaderExtension {
    fn from(h: ExtensionHeader) -> Self {
        match h.id.0 {
            2 => match h.value {
                ExtensionHeaderValue::VarInt(v) => LocHeaderExtension::CaptureTimestamp(v.0),
                _ => LocHeaderExtension::Unknown(h),
            },
            13 => match h.value {
                ExtensionHeaderValue::Bytes(b) => LocHeaderExtension::VideoConfig(b),
                _ => LocHeaderExtension::Unknown(h),
            },
            4 => match h.value {
                ExtensionHeaderValue::VarInt(v) => {
                    LocHeaderExtension::VideoFrameMarking(v.0 as u32)
                }
                _ => LocHeaderExtension::Unknown(h),
            },
            6 => match h.value {
                ExtensionHeaderValue::VarInt(v) => LocHeaderExtension::AudioLevel(v.0 as u16),
                _ => LocHeaderExtension::Unknown(h),
            },
            _ => LocHeaderExtension::Unknown(h),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;

    #[test]
    fn conversion_roundtrip() {
        let original = LocHeaderExtension::CaptureTimestamp(123);
        let header: ExtensionHeader = original.clone().into();
        assert_eq!(header.id, VarInt(2));
        let decoded = LocHeaderExtension::from(header);
        assert_eq!(decoded, original);

        let original = LocHeaderExtension::VideoConfig(Bytes::from_static(b"abc"));
        let header: ExtensionHeader = original.clone().into();
        assert_eq!(header.id, VarInt(13));
        let decoded = LocHeaderExtension::from(header);
        assert_eq!(decoded, original);

        let original = LocHeaderExtension::VideoFrameMarking(5);
        let header: ExtensionHeader = original.clone().into();
        assert_eq!(header.id, VarInt(4));
        let decoded = LocHeaderExtension::from(header);
        assert_eq!(decoded, original);

        let original = LocHeaderExtension::AudioLevel(7);
        let header: ExtensionHeader = original.clone().into();
        assert_eq!(header.id, VarInt(6));
        let decoded = LocHeaderExtension::from(header);
        assert_eq!(decoded, original);
    }
}
