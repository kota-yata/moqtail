import { ANNOUNCE_ERROR_REASON } from '../constants';
export declare const serializeAnnounceError: (props: {
    trackNamespace: string[];
    errorCode: ANNOUNCE_ERROR_REASON;
    reasonPhrase: string;
}) => Uint8Array;
export declare const deserializeAnnounceError: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
    errorCode: ANNOUNCE_ERROR_REASON;
    reasonPhrase: string;
}>;
