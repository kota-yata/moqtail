import { Parameter } from "../utils/parameter";
export declare const serializeServerSetup: (props: {
    version: number;
    params: Parameter[];
}) => Uint8Array;
export declare const deserializeServerSetup: (controlReader: ReadableStream) => Promise<{
    selectedVersion: number;
    parameters: {
        authInfo: string;
        deliveryTimeout: number;
        maxCacheDuration: number;
        setup: {
            path: string;
            maxSubscribeId: number;
        };
    };
}>;
