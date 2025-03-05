import { Parameter } from '../utils/parameter';
export declare const serializeAnnounce: (props: {
    trackNamespace: string[];
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeAnnounce: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
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
