interface Track {
  namespace: string,
  name: string,
  alias?: string,
  subscribeIds: number[],
  type: string,
  priority: number,
}

export class TrackManager {
  private tracks: Track[] = [];
  public addTrack(track: Track) {
    this.tracks.push(track);
  }
  public getTrack(name: string) {
    return this.tracks.find(track => track.name === name);
  }
  public getTrackBySubscribeId(id: number) {
    return this.tracks.find(track => track.subscribeIds.includes(id));
  }
  public getAllTracks() {
    return this.tracks;
  }
  public addSubscribeId(name: string, id: number) {
    this.tracks.map(track => {
      if (track.name === name) {
        track.subscribeIds.push(id);
      }
    });
  }
  public removeSubscribeId(id: number) {
    this.tracks.map(track => {
      const index = track.subscribeIds.indexOf(id);
      if (index > -1) {
        track.subscribeIds.splice(index, 1);
      }
    });
  }
}
