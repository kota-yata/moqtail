export declare const serializeFetchCancel: (subscribeId: number) => Uint8Array;
export declare const deserializeFetchCancel: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
}>;
