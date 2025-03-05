export declare const serializeAnnounceOk: (props: {
    trackNamespace: string[];
}) => Uint8Array;
export declare const deserializeAnnounceOk: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
}>;
