import type { SUBSCRIBE_FILTER } from 'moqtail';

export class TrackManager {
  private tracks: Track[] = [];
  public upsertTrack(track: Track) {
    if (this.getTrack({ name: track.name })) {
      this.tracks[this.tracks.findIndex(t => t.name === track.name)] = track;
    } else {
      this.tracks.push(track);
    }
  }
  public getTrack({ name }: { name: string }): Track | undefined {
    return this.tracks.find(track => track.name === name);
  }
  public getAllTracks() {
    return this.tracks;
  }
  public removeTrack(name: string): boolean {
    const index = this.tracks.findIndex(track => track.name === name);
    if (index !== -1) {
      this.tracks.splice(index, 1);
      return true;
    }
    return false;
  }
  public addSubscriber({ name, requestId, trackAlias, filterType }: { name: string, requestId: number, trackAlias: number, filterType: SUBSCRIBE_FILTER }) {
    const track = this.getTrack({ name });
    if (!track) throw new Error(`Track not found: ${name}`);
    track.subscribers.push({ requestId, trackAlias, filterType });
  }
  public removeSubscriber(requestId: number): Track[] {
    const emptyTracks: Track[] = [];
    this.tracks.forEach(track => {
      track.subscribers = track.subscribers.filter(subscriber => subscriber.requestId !== requestId);
      if (track.subscribers.length === 0) emptyTracks.push(track);
    });
    return emptyTracks;
  }
}
