import { Parameter } from '../utils/parameter';
export declare const serializeSubscribeAnnounces: (props: {
    trackNamespacePrefix: string[];
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeSubscribeAnnounces: (controlReader: ReadableStream) => Promise<{
    trackNamespacePrefix: string[];
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
