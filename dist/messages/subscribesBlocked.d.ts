export declare const serializeSubscribesBlocked: (props: {
    maxSubscribeId: number;
}) => Uint8Array;
export declare const deserializeSubscribesBlocked: (controlReader: ReadableStream) => Promise<{
    maxSubscribeId: number;
}>;
