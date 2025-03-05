import { TRACK_STATUS_CODE } from '../constants';
export declare const serializeTrackStatus: (props: {
    trackNamespace: string[];
    trackName: string;
    statusCode: TRACK_STATUS_CODE;
    lastGroupId: number;
    lastObjectId: number;
}) => Uint8Array;
export declare const deserializeTrackStatus: (controlReader: ReadableStream) => Promise<{
    trackNamespace: string[];
    trackName: string;
    statusCode: TRACK_STATUS_CODE;
    lastGroupId: number;
    lastObjectId: number;
}>;
