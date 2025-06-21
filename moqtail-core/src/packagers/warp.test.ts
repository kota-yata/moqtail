import {
  WARP_VERSION,
  WARP_CATALOG_TRACK_NAME,
  WarpCatalog,
  WarpTrack,
  WarpCatalogPatch,
  TimelineEntry,
  serializeWarpCatalog,
  deserializeWarpCatalogFromArray,
  serializeWarpCatalogPatch,
  serializeTimelineTrack,
  deserializeTimelineTrack,
  validateWarpCatalog,
  createWarpCatalog,
  addTrackToCatalog,
  removeTrackFromCatalog,
  getTracksByRenderGroup,
  getTracksByAltGroup,
  isWarpLocTrack,
  getTimeAlignedTracks,
  createInitialCatalog,
  createTerminatingCatalog,
  WARP_LOC_PACKAGING
} from './warp';

describe('WARP Streaming Format', () => {
  describe('Constants', () => {
    test('should have correct WARP version', () => {
      expect(WARP_VERSION).toBe(1);
    });

    test('should have correct catalog track name', () => {
      expect(WARP_CATALOG_TRACK_NAME).toBe('catalog');
    });

    test('should have correct LOC packaging constant', () => {
      expect(WARP_LOC_PACKAGING).toBe('loc');
    });
  });

  describe('WARP Catalog', () => {
    const sampleTrack: WarpTrack = {
      name: 'video',
      namespace: 'conference.example.com/conference123/alice',
      packaging: 'loc',
      renderGroup: 1,
      codec: 'av01.0.08M.10.0.110.09',
      width: 1920,
      height: 1080,
      framerate: 30,
      bitrate: 1500000
    };

    const sampleCatalog: WarpCatalog = {
      version: 1,
      tracks: [sampleTrack]
    };

    test('should serialize and deserialize catalog', () => {
      const serialized = serializeWarpCatalog(sampleCatalog);
      const deserialized = deserializeWarpCatalogFromArray(serialized);
      
      expect(deserialized).toEqual(sampleCatalog);
    });

    test('should validate valid catalog', () => {
      expect(validateWarpCatalog(sampleCatalog)).toBe(true);
    });

    test('should reject catalog with wrong version', () => {
      const invalidCatalog = { ...sampleCatalog, version: 2 };
      expect(validateWarpCatalog(invalidCatalog)).toBe(false);
    });

    test('should reject catalog with duplicate track names in same namespace', () => {
      const duplicateTrack = { ...sampleTrack };
      const invalidCatalog = {
        ...sampleCatalog,
        tracks: [sampleTrack, duplicateTrack]
      };
      expect(validateWarpCatalog(invalidCatalog)).toBe(false);
    });

    test('should allow duplicate track names in different namespaces', () => {
      const differentNamespaceTrack = { 
        ...sampleTrack, 
        namespace: 'different.namespace'
      };
      const validCatalog = {
        ...sampleCatalog,
        tracks: [sampleTrack, differentNamespaceTrack]
      };
      expect(validateWarpCatalog(validCatalog)).toBe(true);
    });
  });

  describe('WARP Catalog Patch', () => {
    test('should serialize catalog patch', () => {
      const patch: WarpCatalogPatch[] = [
        {
          op: 'add',
          path: '/tracks/-',
          value: {
            name: 'slides',
            codec: 'av01.0.08M.10.0.110.09',
            width: 1920,
            height: 1080,
            framerate: 15,
            bitrate: 750000,
            renderGroup: 1
          }
        }
      ];

      const serialized = serializeWarpCatalogPatch(patch);
      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(0);
    });
  });

  describe('Timeline Track', () => {
    const sampleTimeline: TimelineEntry[] = [
      {
        mediaPts: 1000,
        groupId: 1,
        objectId: 0,
        wallclock: 1640995200000,
        metadata: 'test metadata'
      },
      {
        mediaPts: 2000,
        groupId: 1,
        objectId: 1,
        wallclock: 1640995201000
      }
    ];

    test('should serialize and deserialize timeline track', () => {
      const serialized = serializeTimelineTrack(sampleTimeline);
      const deserialized = deserializeTimelineTrack(serialized);
      
      expect(deserialized).toEqual(sampleTimeline);
    });

    test('should handle CSV with quotes in metadata', () => {
      const timelineWithQuotes: TimelineEntry[] = [
        {
          mediaPts: 1000,
          groupId: 1,
          objectId: 0,
          wallclock: 1640995200000,
          metadata: 'metadata with "quotes" inside'
        }
      ];

      const serialized = serializeTimelineTrack(timelineWithQuotes);
      const deserialized = deserializeTimelineTrack(serialized);
      
      expect(deserialized).toEqual(timelineWithQuotes);
    });

    test('should handle empty optional fields', () => {
      const minimalTimeline: TimelineEntry[] = [
        {
          mediaPts: 1000,
          wallclock: 1640995200000
        }
      ];

      const serialized = serializeTimelineTrack(minimalTimeline);
      const deserialized = deserializeTimelineTrack(serialized);
      
      expect(deserialized).toEqual(minimalTimeline);
    });
  });

  describe('Catalog Utility Functions', () => {
    const videoTrack: WarpTrack = {
      name: 'video',
      packaging: 'loc',
      renderGroup: 1,
      codec: 'av01',
      width: 1920,
      height: 1080
    };

    const audioTrack: WarpTrack = {
      name: 'audio',
      packaging: 'loc',
      renderGroup: 1,
      codec: 'opus',
      samplerate: 48000
    };

    const alternateVideoTrack: WarpTrack = {
      name: 'video-hd',
      packaging: 'loc',
      renderGroup: 1,
      altGroup: 1,
      codec: 'av01',
      width: 1920,
      height: 1080
    };

    test('should create WARP catalog', () => {
      const catalog = createWarpCatalog([videoTrack, audioTrack], true);
      
      expect(catalog.version).toBe(WARP_VERSION);
      expect(catalog.supportsDeltaUpdates).toBe(true);
      expect(catalog.tracks).toHaveLength(2);
    });

    test('should add track to catalog', () => {
      const initialCatalog = createWarpCatalog([videoTrack]);
      const updatedCatalog = addTrackToCatalog(initialCatalog, audioTrack);
      
      expect(updatedCatalog.tracks).toHaveLength(2);
      expect(updatedCatalog.tracks[1]).toEqual(audioTrack);
    });

    test('should remove track from catalog', () => {
      const initialCatalog = createWarpCatalog([videoTrack, audioTrack]);
      const updatedCatalog = removeTrackFromCatalog(initialCatalog, 'audio');
      
      expect(updatedCatalog.tracks).toHaveLength(1);
      expect(updatedCatalog.tracks[0]).toEqual(videoTrack);
    });

    test('should get tracks by render group', () => {
      const catalog = createWarpCatalog([videoTrack, audioTrack]);
      const renderGroupTracks = getTracksByRenderGroup(catalog, 1);
      
      expect(renderGroupTracks).toHaveLength(2);
      expect(renderGroupTracks).toContain(videoTrack);
      expect(renderGroupTracks).toContain(audioTrack);
    });

    test('should get tracks by alternate group', () => {
      const catalog = createWarpCatalog([videoTrack, alternateVideoTrack]);
      const altGroupTracks = getTracksByAltGroup(catalog, 1);
      
      expect(altGroupTracks).toHaveLength(1);
      expect(altGroupTracks[0]).toEqual(alternateVideoTrack);
    });

    test('should identify LOC tracks', () => {
      expect(isWarpLocTrack(videoTrack)).toBe(true);
      
      const nonLocTrack = { ...videoTrack, packaging: 'other' };
      expect(isWarpLocTrack(nonLocTrack)).toBe(false);
    });

    test('should get time-aligned tracks', () => {
      const catalog = createWarpCatalog([videoTrack, audioTrack]);
      const timeAlignedGroups = getTimeAlignedTracks(catalog);
      
      expect(timeAlignedGroups).toHaveLength(1);
      expect(timeAlignedGroups[0]).toHaveLength(2);
    });

    test('should create initial catalog', () => {
      const catalog = createInitialCatalog([videoTrack, audioTrack]);
      
      expect(catalog.version).toBe(WARP_VERSION);
      expect(catalog.supportsDeltaUpdates).toBe(true);
      expect(catalog.tracks).toHaveLength(2);
    });

    test('should create terminating catalog', () => {
      const catalog = createTerminatingCatalog();
      
      expect(catalog.version).toBe(WARP_VERSION);
      expect(catalog.supportsDeltaUpdates).toBe(false);
      expect(catalog.tracks).toHaveLength(0);
    });
  });
});