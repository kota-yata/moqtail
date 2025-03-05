import { SUBSCRIBE_DONE_REASON } from '../constants';
export declare const serializeSubscribeDone: (props: {
    subscribeId: number;
    statusCode: SUBSCRIBE_DONE_REASON;
    reasonPhrase: string;
    streamCount: number;
}) => Uint8Array;
export declare const deserializeSubscribeDone: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    statusCode: SUBSCRIBE_DONE_REASON;
    reasonPhrase: string;
    streamCount: number;
}>;
