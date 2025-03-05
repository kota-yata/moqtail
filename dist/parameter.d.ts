export interface Parameter {
    type: number;
    value: string | number;
}
/**
 * Parameter Length (i),
 * Parameter {
     Parameter Type (i),
     Parameter Length (i),
     Parameter Value (..),
   }[]
 */
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
