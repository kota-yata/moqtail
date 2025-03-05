export interface Parameter {
    type: number;
    value: string | number;
}
export declare const serializeParams: (params: Parameter[]) => Uint8Array;
export declare const deserializeParams: (messageType: number, controlReader: ReadableStream) => Promise<{
    authInfo: string;
    deliveryTimeout: number;
    maxCacheDuration: number;
    setup: {
        path: string;
        maxSubscribeId: number;
    };
}>;
