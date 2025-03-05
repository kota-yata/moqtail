import { FETCH_TYPE } from '../constants';
import { Parameter } from '../utils/parameter';
export declare const serializeFetch: (props: {
    subscribeId: number;
    subscriberPriority: number;
    groupOrder: number;
    fetchType: FETCH_TYPE;
    trackNamespace?: string[];
    trackName?: string;
    startGroup?: number;
    startObject?: number;
    endGroup?: number;
    endObject?: number;
    joiningSubscribeId?: number;
    precedingGroupOffset?: number;
    parameters?: Parameter[];
}) => Uint8Array;
export declare const deserializeFetch: (controlReader: ReadableStream) => Promise<any>;
