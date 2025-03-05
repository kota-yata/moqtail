export declare const serializeTrackStatusRequest: (props: {
    trackNamespace: string[];
    trackName: string;
}) => Uint8Array;
export declare const deserializeTrackStatusRequest: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
    trackName: string;
}>;
