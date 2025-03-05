import { Parameter } from "../utils/parameter";
export declare const serializeClientSetup: (props: {
    supportedVersions: number[];
    params: Parameter[];
}) => Uint8Array;
export declare const deserializeClientSetup: (controlReader: ReadableStream) => Promise<{
    versions: number[];
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
