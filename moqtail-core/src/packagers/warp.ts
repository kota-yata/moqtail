// WARP (WARP Streaming Format) implementation
// Based on draft-ietf-moq-warp-00

import { varBytesToString } from "bytes";

// WARP version 1 as specified in the draft
/** Current WARP catalog version supported. */
export const WARP_VERSION = 1;
export const WARP_CATALOG_TRACK_NAME = "catalog";

// WARP Catalog interfaces
/** Catalog describing available tracks and session capabilities. */
export interface WarpCatalog {
  version: number;
  supportsDeltaUpdates?: boolean;
  tracks: WarpTrack[];
}

export interface WarpTrack {
  // Required fields
  name: string;
  packaging: string;
  
  // Optional fields
  namespace?: string;
  label?: string;
  renderGroup?: number;
  altGroup?: number;
  initData?: string; // Base64 encoded
  depends?: string[];
  temporalId?: number;
  spatialId?: number;
  codec?: string;
  mimeType?: string;
  framerate?: number;
  bitrate?: number;
  width?: number;
  height?: number;
  samplerate?: number;
  channelConfig?: string;
  displayWidth?: number;
  displayHeight?: number;
  lang?: string;
  
  // Custom fields are allowed (must not collide with standard fields)
  [key: string]: any;
}

// WARP Catalog Patch (JSON Patch format)
/** A JSON Patch operation for catalog updates. */
export interface WarpCatalogPatch {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

// Timeline track interfaces
export interface TimelineEntry {
  mediaPts: number;
  groupId?: number;
  objectId?: number;
  wallclock: number;
  metadata?: string;
}

export interface TimelineTrack {
  name: string;
  type: 'timeline';
  mimeType: 'text/csv';
  dependencies: string[];
  entries: TimelineEntry[];
}

// WARP Catalog serialization
/** Serialize a `WarpCatalog` as UTF-8 JSON bytes. */
export const serializeWarpCatalog = (catalog: WarpCatalog): Uint8Array => {
  const jsonString = JSON.stringify(catalog);
  return new TextEncoder().encode(jsonString);
};

/** Deserialize a `WarpCatalog` from a stream of JSON bytes. */
export const deserializeWarpCatalog = async (reader: ReadableStream): Promise<WarpCatalog> => {
  const jsonString = await varBytesToString(reader);
  return JSON.parse(jsonString) as WarpCatalog;
};

/** Deserialize a `WarpCatalog` from a byte array. */
export const deserializeWarpCatalogFromArray = (data: Uint8Array): WarpCatalog => {
  const jsonString = new TextDecoder().decode(data);
  return JSON.parse(jsonString) as WarpCatalog;
};

// WARP Catalog Patch serialization
/** Serialize catalog patch operations as UTF-8 JSON bytes. */
export const serializeWarpCatalogPatch = (patch: WarpCatalogPatch[]): Uint8Array => {
  const jsonString = JSON.stringify(patch);
  return new TextEncoder().encode(jsonString);
};

/** Deserialize catalog patch operations from a stream. */
export const deserializeWarpCatalogPatch = async (reader: ReadableStream): Promise<WarpCatalogPatch[]> => {
  const jsonString = await varBytesToString(reader);
  return JSON.parse(jsonString) as WarpCatalogPatch[];
};

// Timeline track serialization (CSV format)
/** Serialize timeline entries to CSV (CRLF) as UTF-8 bytes. */
export const serializeTimelineTrack = (timeline: TimelineEntry[]): Uint8Array => {
  const header = "MEDIA_PTS,GROUP_ID,OBJECT_ID,WALLCLOCK,METADATA\r\n";
  const rows = timeline.map(entry => {
    const groupId = entry.groupId !== undefined ? entry.groupId.toString() : '';
    const objectId = entry.objectId !== undefined ? entry.objectId.toString() : '';
    const metadata = entry.metadata ? `"${entry.metadata.replace(/"/g, '""')}"` : '';
    return `${entry.mediaPts},${groupId},${objectId},${entry.wallclock},${metadata}`;
  }).join('\r\n');
  
  const csvContent = header + rows;
  return new TextEncoder().encode(csvContent);
};

/** Parse a CSV timeline into `TimelineEntry` objects. */
export const deserializeTimelineTrack = (data: Uint8Array): TimelineEntry[] => {
  const csvContent = new TextDecoder().decode(data);
  const lines = csvContent.split('\r\n');
  
  // Skip header line
  const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
  
  return dataLines.map(line => {
    const parts = parseCSVLine(line);
    return {
      mediaPts: parseInt(parts[0]),
      groupId: parts[1] ? parseInt(parts[1]) : undefined,
      objectId: parts[2] ? parseInt(parts[2]) : undefined,
      wallclock: parseInt(parts[3]),
      metadata: parts[4] ? parts[4].replace(/^"|"$/g, '').replace(/""/g, '"') : undefined
    };
  });
};

// Helper function to parse CSV line with proper quote handling
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  result.push(current);
  return result;
};

// WARP Catalog validation
/** Validate minimal structural requirements of a `WarpCatalog`. */
export const validateWarpCatalog = (catalog: WarpCatalog): boolean => {
  // Check required fields
  if (typeof catalog.version !== 'number' || catalog.version !== WARP_VERSION) {
    return false;
  }
  
  if (!Array.isArray(catalog.tracks)) {
    return false;
  }
  
  // Check track names are unique per namespace
  const trackMap = new Map<string, Set<string>>();
  
  for (const track of catalog.tracks) {
    if (typeof track.name !== 'string' || typeof track.packaging !== 'string') {
      return false;
    }
    
    const namespace = track.namespace || '';
    if (!trackMap.has(namespace)) {
      trackMap.set(namespace, new Set());
    }
    
    const names = trackMap.get(namespace)!;
    if (names.has(track.name)) {
      return false; // Duplicate track name in same namespace
    }
    names.add(track.name);
  }
  
  return true;
};

// WARP Catalog utility functions
/** Create a baseline `WarpCatalog` with given tracks. */
export const createWarpCatalog = (tracks: WarpTrack[], supportsDeltaUpdates = false): WarpCatalog => {
  return {
    version: WARP_VERSION,
    supportsDeltaUpdates,
    tracks
  };
};

/** Return a new catalog with `track` appended. */
export const addTrackToCatalog = (catalog: WarpCatalog, track: WarpTrack): WarpCatalog => {
  return {
    ...catalog,
    tracks: [...catalog.tracks, track]
  };
};

/** Return a new catalog without the specified track. */
export const removeTrackFromCatalog = (catalog: WarpCatalog, trackName: string, namespace?: string): WarpCatalog => {
  return {
    ...catalog,
    tracks: catalog.tracks.filter(track => 
      !(track.name === trackName && (track.namespace || '') === (namespace || ''))
    )
  };
};

/** Group tracks by `renderGroup` and return collections of aligned tracks. */
export const getTracksByRenderGroup = (catalog: WarpCatalog, renderGroup: number): WarpTrack[] => {
  return catalog.tracks.filter(track => track.renderGroup === renderGroup);
};

/** Filter tracks by `altGroup`. */
export const getTracksByAltGroup = (catalog: WarpCatalog, altGroup: number): WarpTrack[] => {
  return catalog.tracks.filter(track => track.altGroup === altGroup);
};

// WARP LOC packaging constants
export const WARP_LOC_PACKAGING = "loc";

// WARP utility functions for LOC packaging
/** Whether a track uses LOC packaging. */
export const isWarpLocTrack = (track: WarpTrack): boolean => {
  return track.packaging === WARP_LOC_PACKAGING;
};

/** Group tracks by `renderGroup` to help align time-synchronized media. */
export const getTimeAlignedTracks = (catalog: WarpCatalog): WarpTrack[][] => {
  const renderGroups = new Map<number, WarpTrack[]>();
  
  catalog.tracks.forEach(track => {
    if (track.renderGroup !== undefined) {
      if (!renderGroups.has(track.renderGroup)) {
        renderGroups.set(track.renderGroup, []);
      }
      renderGroups.get(track.renderGroup)!.push(track);
    }
  });
  
  return Array.from(renderGroups.values());
};

// WARP media transmission helpers
/** For WARP, each encoded chunk is a separate object; return payload as-is. */
export const createWarpMediaObject = (payload: Uint8Array): Uint8Array => {
  // For WARP, each EncodedAudioChunk or EncodedVideoChunk sample
  // is placed in a separate MOQT Object
  // This is handled by the LOC packager, so we just return the payload
  return payload;
};

// WARP workflow helpers
/** Create an initial catalog announcing tracks, using delta updates. */
export const createInitialCatalog = (tracks: WarpTrack[]): WarpCatalog => {
  return createWarpCatalog(tracks, true);
};

/** Create a terminating catalog signalling end of session. */
export const createTerminatingCatalog = (): WarpCatalog => {
  return createWarpCatalog([], false);
};
