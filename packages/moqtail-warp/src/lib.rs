use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Packaging modes supported by WARP.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Packaging {
    /// Low Overhead Container packaging.
    Loc,
}

impl Default for Packaging {
    fn default() -> Self {
        Packaging::Loc
    }
}

/// Description of a single media track in the catalog.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Track {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    pub packaging: Packaging,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "renderGroup", skip_serializing_if = "Option::is_none")]
    pub render_group: Option<u64>,
    #[serde(rename = "altGroup", skip_serializing_if = "Option::is_none")]
    pub alt_group: Option<u64>,
    #[serde(rename = "initData", skip_serializing_if = "Option::is_none")]
    pub init_data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depends: Option<Vec<String>>,
    #[serde(rename = "temporalId", skip_serializing_if = "Option::is_none")]
    pub temporal_id: Option<u64>,
    #[serde(rename = "spatialId", skip_serializing_if = "Option::is_none")]
    pub spatial_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub framerate: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bitrate: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u64>,
    #[serde(rename = "samplerate", skip_serializing_if = "Option::is_none")]
    pub sample_rate: Option<u64>,
    #[serde(rename = "channelConfig", skip_serializing_if = "Option::is_none")]
    pub channel_config: Option<String>,
    #[serde(rename = "displayWidth", skip_serializing_if = "Option::is_none")]
    pub display_width: Option<u64>,
    #[serde(rename = "displayHeight", skip_serializing_if = "Option::is_none")]
    pub display_height: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// The root catalog information advertising available tracks.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Catalog {
    pub version: u64,
    #[serde(
        rename = "supportsDeltaUpdates",
        skip_serializing_if = "Option::is_none"
    )]
    pub supports_delta_updates: Option<bool>,
    pub tracks: Vec<Track>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Parse a catalog JSON document into a [`Catalog`] structure.
pub fn parse_catalog(data: &str) -> serde_json::Result<Catalog> {
    serde_json::from_str(data)
}

/// Serialize a [`Catalog`] structure into JSON text.
pub fn serialize_catalog(catalog: &Catalog) -> serde_json::Result<String> {
    serde_json::to_string(catalog)
}

/// A single record within a timeline track.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimelineRecord {
    pub media_pts: i64,
    pub group_id: Option<u64>,
    pub object_id: Option<u64>,
    pub wallclock: i64,
    pub metadata: Option<String>,
}

/// Parse timeline CSV payload into a vector of [`TimelineRecord`].
pub fn parse_timeline(csv: &str) -> Result<Vec<TimelineRecord>, Box<dyn std::error::Error>> {
    let mut lines = csv.lines();
    let header = lines.next().ok_or_else(|| "empty timeline")?;
    let expected = "MEDIA_PTS,GROUP_ID,OBJECT_ID,WALLCLOCK,METADATA";
    if header.trim() != expected {
        return Err("invalid timeline header".into());
    }

    let mut records = Vec::new();
    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() != 5 {
            return Err("invalid record".into());
        }
        let media_pts = parts[0].parse()?;
        let group_id = if parts[1].is_empty() {
            None
        } else {
            Some(parts[1].parse()?)
        };
        let object_id = if parts[2].is_empty() {
            None
        } else {
            Some(parts[2].parse()?)
        };
        let wallclock = parts[3].parse()?;
        let metadata = if parts[4].is_empty() {
            None
        } else {
            let trimmed = parts[4].trim_matches('"');
            Some(trimmed.replace("\"\"", "\""))
        };
        records.push(TimelineRecord {
            media_pts,
            group_id,
            object_id,
            wallclock,
            metadata,
        });
    }
    Ok(records)
}
