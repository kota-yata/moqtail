export declare const serializeUnsubscribe: (subscribeId: number) => Uint8Array;
export declare const deserializeUnsubscribe: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
}>;
