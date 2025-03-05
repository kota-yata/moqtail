import { SUBSCRIBE_ERROR_REASON } from '../constants';
export declare const serializeSubscribeError: (props: {
    subscribeId: number;
    errorCode: SUBSCRIBE_ERROR_REASON;
    reasonPhrase: string;
    trackAlias: number;
}) => Uint8Array;
export declare const deserializeSubscribeError: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    errorCode: SUBSCRIBE_ERROR_REASON;
    reasonPhrase: string;
    trackAlias: number;
}>;
