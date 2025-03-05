import { FETCH_ERROR_REASON } from '../constants';
export declare const serializeFetchError: (props: {
    subscribeId: number;
    errorCode: FETCH_ERROR_REASON;
    reasonPhrase: string;
}) => Uint8Array;
export declare const deserializeFetchError: (controlReader: ReadableStream) => Promise<{
    subscribeId: number;
    errorCode: FETCH_ERROR_REASON;
    reasonPhrase: string;
}>;
