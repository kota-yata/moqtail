import { Parameter } from '../utils/parameter';
export declare const serializeSubscribeUpdate: (props: {
    subscribeId: number;
    startGroup: number;
    startObject: number;
    endGroup: number;
    subscriberPriority: number;
    parameters: Parameter[];
}) => Uint8Array;
export declare const deserializeSubscribeUpdate: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    startGroup: number;
    startObject: number;
    endGroup: number;
    subscriberPriority: number;
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
