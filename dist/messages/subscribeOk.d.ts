import { CONTENT_EXISTS } from "../constants";
import { Parameter } from "../utils/parameter";
export declare const serializeSubscribeOk: (props: {
    subscribeId: number;
    expires: number;
    groupOrder: number;
    contentExists: CONTENT_EXISTS;
    largestGroupId?: number;
    largestObjectId?: number;
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeSubscribeOk: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    expires: number;
    groupOrder: number;
    contentExists: CONTENT_EXISTS;
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
