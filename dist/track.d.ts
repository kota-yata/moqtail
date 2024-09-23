interface Track {
    namespace: string;
    name: string;
    alias?: string;
    subscribeIds: number[];
    type: string;
    priority: number;
}
export declare class TrackManager {
    private tracks;
    addTrack(track: Track): void;
    getTrack(name: string): Track;
    getTrackBySubscribeId(id: number): Track;
    getAllTracks(): Track[];
    addSubscribeId(name: string, id: number): void;
    removeSubscribeId(id: number): void;
}
export {};
