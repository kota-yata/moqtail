export declare const serializeUnannounce: (trackNamespace: string[]) => Uint8Array;
export declare const deserializeUnannounce: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
}>;
