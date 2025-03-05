import { Parameter } from '../utils/parameter';
export declare const serializeFetchOk: (props: {
    subscribeId: number;
    groupOrder: number;
    endOfTrack: number;
    largestGroupId: number;
    largestObjectId: number;
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeFetchOk: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    groupOrder: number;
    endOfTrack: number;
    largestGroupId: number;
    largestObjectId: number;
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
