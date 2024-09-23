export class TrackManager {
    constructor() {
        this.tracks = [];
    }
    addTrack(track) {
        this.tracks.push(track);
    }
    getTrack(name) {
        return this.tracks.find(track => track.name === name);
    }
    getTrackBySubscribeId(id) {
        return this.tracks.find(track => track.subscribeIds.includes(id));
    }
    getAllTracks() {
        return this.tracks;
    }
    addSubscribeId(name, id) {
        this.tracks.map(track => {
            if (track.name === name) {
                track.subscribeIds.push(id);
            }
        });
    }
    removeSubscribeId(id) {
        this.tracks.map(track => {
            const index = track.subscribeIds.indexOf(id);
            if (index > -1) {
                track.subscribeIds.splice(index, 1);
            }
        });
    }
}
