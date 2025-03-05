import { SUBSCRIBE_ANNOUNCES_ERROR_REASON } from '../constants';
export declare const serializeSubscribeAnnouncesError: (props: {
    trackNamespacePrefix: string[];
    errorCode: SUBSCRIBE_ANNOUNCES_ERROR_REASON;
    reasonPhrase: string;
}) => Uint8Array;
export declare const deserializeSubscribeAnnouncesError: (controlReader: ReadableStream) => Promise<{
    trackNamespacePrefix: string[];
    errorCode: SUBSCRIBE_ANNOUNCES_ERROR_REASON;
    reasonPhrase: string;
}>;
