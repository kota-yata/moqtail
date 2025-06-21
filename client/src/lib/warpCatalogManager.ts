// WARP Catalog Manager for client integration
import {
  WarpCatalog,
  WarpTrack,
  WarpCatalogPatch,
  WARP_CATALOG_TRACK_NAME,
  WARP_LOC_PACKAGING,
  createWarpCatalog,
  addTrackToCatalog,
  removeTrackFromCatalog,
  validateWarpCatalog,
  serializeWarpCatalog,
  deserializeWarpCatalogFromArray,
  getTracksByRenderGroup,
  getTracksByAltGroup,
  getTimeAlignedTracks,
  createInitialCatalog,
  createTerminatingCatalog
} from 'moqtail';
import { Mogger } from './utils/mogger';
import type { TrackManager } from './trackManager';

export class WarpCatalogManager {
  private currentCatalog: WarpCatalog | null = null;
  private catalogUpdateCallbacks: ((catalog: WarpCatalog) => void)[] = [];
  private trackUpdateCallbacks: ((tracks: WarpTrack[]) => void)[] = [];
  private trackManager: TrackManager | null = null;
  setTrackManager(trackManager: TrackManager): void {
    this.trackManager = trackManager;
  }
  getCurrentCatalog(): WarpCatalog | null {
    return this.currentCatalog;
  }
  initializeCatalog(namespace?: string): WarpCatalog {
    if (!this.trackManager) {
      throw new Error('TrackManager not set. Call setTrackManager() first.');
    }

    const allTracks = this.trackManager.getAllTracks();
    // Filter out catalog tracks to avoid circular references
    const mediaTracks = allTracks.filter(track => track.type !== 'catalog');
    const warpTracks: WarpTrack[] = mediaTracks.map(track => this.convertTrackToWarpTrack(track, namespace));
    this.currentCatalog = createInitialCatalog(warpTracks);
    this.notifyCatalogUpdate();
    return this.currentCatalog;
  }
  // Convert existing Track to WarpTrack
  public convertTrackToWarpTrack(track: Track, namespace?: string): WarpTrack {
    const warpTrack: WarpTrack = {
      name: track.name,
      packaging: WARP_LOC_PACKAGING,
      namespace: namespace || track.namespace.join('/')
    };

    // Add codec information if available
    if (track.encoderConfig?.encoderConfig) {
      const config = track.encoderConfig.encoderConfig;
      warpTrack.codec = config.codec;

      if ('width' in config && 'height' in config) {
        // Video track
        warpTrack.width = config.width;
        warpTrack.height = config.height;
        warpTrack.framerate = config.framerate;
        warpTrack.mimeType = 'video';
      } else if ('sampleRate' in config && 'numberOfChannels' in config) {
        // Audio track
        warpTrack.samplerate = config.sampleRate;
        warpTrack.channelConfig = config.numberOfChannels.toString();
        warpTrack.mimeType = 'audio';
      }
    }

    return warpTrack;
  }
  // Update catalog from serialized data (for subscriber)
  updateCatalogFromData(data: Uint8Array): WarpCatalog | null {
    try {
      // Try to parse as catalog
      const catalog = deserializeWarpCatalogFromArray(data);
      if (validateWarpCatalog(catalog)) {
        this.currentCatalog = catalog;
        this.notifyCatalogUpdate();
        Mogger.info('WARP catalog updated');
        return catalog;
      }
    } catch (e) {
      try {
        // Try to parse as patch
        const patchString = new TextDecoder().decode(data);
        const patch: WarpCatalogPatch[] = JSON.parse(patchString);
        if (Array.isArray(patch) && this.currentCatalog) {
          this.applyPatch(patch);
          return this.currentCatalog;
        }
      } catch (patchError) {
        Mogger.error('Failed to parse WARP catalog or patch data');
      }
    }
    return null;
  }
  // Apply JSON patch to current catalog
  private applyPatch(patch: WarpCatalogPatch[]): void {
    if (!this.currentCatalog) {
      Mogger.error('Cannot apply patch: no current catalog');
      return;
    }

    // Simple patch implementation for basic operations
    for (const operation of patch) {
      try {
        switch (operation.op) {
        case 'add':
          if (operation.path === '/tracks/-') {
            // Add track to end of tracks array
            this.currentCatalog = addTrackToCatalog(this.currentCatalog, operation.value as WarpTrack);
          }
          break;
        case 'remove':
          if (operation.path.startsWith('/tracks/')) {
            const index = parseInt(operation.path.split('/')[2]);
            if (index >= 0 && index < this.currentCatalog.tracks.length) {
              const trackToRemove = this.currentCatalog.tracks[index];
              this.currentCatalog = removeTrackFromCatalog(
                this.currentCatalog,
                trackToRemove.name,
                trackToRemove.namespace
              );
            }
          }
          break;
          // Add more patch operations as needed
        }
      } catch (error) {
        Mogger.error(`Failed to apply patch operation: ${error}`);
      }
    }

    this.notifyCatalogUpdate();
  }
  // Rebuild catalog from current tracks in trackManager
  rebuildCatalog(namespace?: string): void {
    if (!this.trackManager) {
      throw new Error('TrackManager not set. Call setTrackManager() first.');
    }

    const allTracks = this.trackManager.getAllTracks();
    // Filter out catalog tracks to avoid circular references
    const mediaTracks = allTracks.filter(track => track.type !== 'catalog');
    const warpTracks: WarpTrack[] = mediaTracks.map(track => this.convertTrackToWarpTrack(track, namespace));

    if (warpTracks.length === 0) {
      this.currentCatalog = createTerminatingCatalog();
    } else {
      this.currentCatalog = createInitialCatalog(warpTracks);
    }
    this.notifyCatalogUpdate();
  }
  addTrack(trackName: string, namespace?: string): void {
    this.rebuildCatalog(namespace);
  }
  removeTrack(trackName: string, namespace?: string): void {
    this.rebuildCatalog(namespace);
  }
  // Get tracks by render group (time-aligned tracks)
  getTimeAlignedTracks(): WarpTrack[][] {
    if (!this.currentCatalog) return [];
    return getTimeAlignedTracks(this.currentCatalog);
  }
  getTracksByRenderGroup(renderGroup: number): WarpTrack[] {
    if (!this.currentCatalog) return [];
    return getTracksByRenderGroup(this.currentCatalog, renderGroup);
  }
  getTracksByAltGroup(altGroup: number): WarpTrack[] {
    if (!this.currentCatalog) return [];
    return getTracksByAltGroup(this.currentCatalog, altGroup);
  }
  getAvailableRenderGroups(): number[] {
    if (!this.currentCatalog) return [];
    const groups = new Set<number>();
    this.currentCatalog.tracks.forEach(track => {
      if (track.renderGroup !== undefined) {
        groups.add(track.renderGroup);
      }
    });
    return Array.from(groups).sort();
  }
  getAvailableAltGroups(): number[] {
    if (!this.currentCatalog) return [];
    const groups = new Set<number>();
    this.currentCatalog.tracks.forEach(track => {
      if (track.altGroup !== undefined) {
        groups.add(track.altGroup);
      }
    });
    return Array.from(groups).sort();
  }
  // Serialize current catalog for transmission
  serializeCatalog(): Uint8Array | null {
    if (!this.currentCatalog) return null;
    return serializeWarpCatalog(this.currentCatalog);
  }
  // Create patch for track addition (rebuilds catalog and creates full update)
  createAddTrackPatch(trackName: string, namespace?: string): Uint8Array {
    // For now, just rebuild the entire catalog
    // In the future, we could optimize this to create actual patches
    this.rebuildCatalog(namespace);
    return this.serializeCatalog() || new Uint8Array(0);
  }
  // Create patch for track removal (rebuilds catalog and creates full update)
  createRemoveTrackPatch(trackName: string, namespace?: string): Uint8Array | null {
    // For now, just rebuild the entire catalog
    // In the future, we could optimize this to create actual patches
    this.rebuildCatalog(namespace);
    return this.serializeCatalog();
  }
  createTerminatingCatalog(): Uint8Array {
    this.currentCatalog = createTerminatingCatalog();
    this.notifyCatalogUpdate();
    return serializeWarpCatalog(this.currentCatalog);
  }
  onCatalogUpdate(callback: (catalog: WarpCatalog) => void): void {
    this.catalogUpdateCallbacks.push(callback);
  }
  onTrackUpdate(callback: (tracks: WarpTrack[]) => void): void {
    this.trackUpdateCallbacks.push(callback);
  }
  // Notify all callbacks of catalog update
  private notifyCatalogUpdate(): void {
    if (this.currentCatalog) {
      this.catalogUpdateCallbacks.forEach(callback => callback(this.currentCatalog!));
      this.trackUpdateCallbacks.forEach(callback => callback(this.currentCatalog!.tracks));
    }
  }
  getTrack(trackName: string, namespace?: string): WarpTrack | undefined {
    if (!this.currentCatalog) return undefined;
    return this.currentCatalog.tracks.find(track =>
      track.name === trackName && (track.namespace || '') === (namespace || '')
    );
  }
  supportsDeltaUpdates(): boolean {
    return this.currentCatalog?.supportsDeltaUpdates ?? false;
  }
  getAllTracks(): WarpTrack[] {
    return this.currentCatalog?.tracks ?? [];
  }
  clear(): void {
    this.currentCatalog = null;
    this.catalogUpdateCallbacks.forEach(callback => callback(null as any));
    this.trackUpdateCallbacks.forEach(callback => callback([]));
  }
}
