import { Parameter } from "../parameter";
export declare const serializeSubscribe: (props: {
    subscribeId: number;
    trackAlias: number;
    namespace: string[];
    trackName: string;
    subscriberPriority: number;
    groupOrder: number;
    filterType: number;
    startGroup?: number;
    startObject?: number;
    endGroup?: number;
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeSubscribe: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    trackAlias: number;
    namespace: string[];
    trackName: string;
    subscriberPriority: number;
    groupOrder: number;
    filterType: number;
    startGroup: number;
    startObject: number;
    endGroup: number;
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
