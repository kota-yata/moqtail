import { GROUP_ORDER, SUBSCRIBE_FILTER } from "../constants";
import { Parameter } from "../utils/parameter";
export declare const serializeSubscribe: (props: {
    subscribeId: number;
    trackAlias: number;
    namespace: string[];
    trackName: string;
    subscriberPriority: number;
    groupOrder: GROUP_ORDER;
    filterType: SUBSCRIBE_FILTER;
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
    groupOrder: GROUP_ORDER;
    filterType: SUBSCRIBE_FILTER;
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
