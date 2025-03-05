export declare const MOQT_DRAFT09_VERSION = 4278190089;
export declare const MOQT_DRAFT10_VERSION = 4278190090;
export declare const MOQT_SUPPORTED_VERSIONS: number[];
export declare const PARAMETER: {
    AUTHORIZATION_INFO: {
        KEY: number;
    };
    DELIVERY_TIMOUT: {
        KEY: number;
    };
    MAX_CACHE_DURATION: {
        KEY: number;
    };
    SETUP: {
        PATH: {
            KEY: number;
        };
        MAX_SUBSCRIBE_ID: {
            KEY: number;
        };
    };
};
type ObjectValueList<T extends Record<any, any>> = T[keyof T];
export declare const CONTROL_MESSAGE: {
    readonly CLIENT_SETUP: 64;
    readonly SERVER_SETUP: 65;
    readonly GOAWAY: 16;
    readonly MAX_SUBSCRIBE_ID: 21;
    readonly SUBSCRIBES_BLOCKED: 22;
    readonly SUBSCRIBE: 3;
    readonly SUBSCRIBE_OK: 4;
    readonly SUBSCRIBE_ERROR: 5;
    readonly UNSUBSCRIBE: 10;
    readonly SUBSCRIBE_UPDATE: 2;
    readonly SUBSCRIBE_DONE: 11;
    readonly FETCH: 22;
    readonly FETCH_OK: 24;
    readonly FETCH_ERROR: 25;
    readonly FETCH_CANCEL: 23;
    readonly TRACK_STATUS_REQUEST: 13;
    readonly TRACK_STATUS: 14;
    readonly ANNOUNCE: 6;
    readonly ANNOUNCE_OK: 7;
    readonly ANNOUNCE_ERROR: 8;
    readonly UNANNOUNCE: 9;
    readonly ANNOUNCE_CANCEL: 12;
    readonly SUBSCRIBE_ANNOUNCES: 17;
    readonly SUBSCRIBE_ANNOUNCES_OK: 18;
    readonly SUBSCRIBE_ANNOUNCES_ERROR: 19;
    readonly UNSUBSCRIBE_ANNOUNCES: 20;
};
export declare const SESSION_CLOSE_ERROR_REASON: {
    readonly NO_ERROR: 0;
    readonly INTERNAL_ERROR: 1;
    readonly UNAUTHORIZED: 2;
    readonly PROTOCOL_VIOLATION: 3;
    readonly DUPLICATE_TRACK_ALIAS: 4;
    readonly PARAMETER_LENGTH_MISMATCH: 5;
    readonly TO_MANY_SUBSCRIBES: 6;
    readonly GOAWAY_TIMEOUT: 16;
    readonly CONTROL_MESSAGE_TIMEOUT: 17;
    readonly DATA_STREAM_TIMEOUT: 18;
};
export declare const SUBSCRIBE_ERROR_REASON: {
    readonly INTERNAL_ERROR: 0;
    readonly UNAUTHORIZED: 1;
    readonly TIMEOUT: 2;
    readonly NOT_SUPPORTED: 3;
    readonly TRACK_DOES_NOT_EXIST: 4;
    readonly INVALID_RANGE: 5;
    readonly RETRY_TRACK_ALIAS: 6;
};
export type SUBSCRIBE_ERROR_REASON = ObjectValueList<typeof SUBSCRIBE_ERROR_REASON>;
export declare const SUBSCRIBE_DONE_REASON: {
    readonly INTERNAL_ERROR: 0;
    readonly UNAUTHORIAZED: 1;
    readonly TRACK_ENDED: 2;
    readonly SUBSCRIPTION_ENDED: 3;
    readonly GOING_AWAY: 4;
    readonly EXPIRED: 5;
    readonly TOO_FAR_BEHIND: 6;
};
export type SUBSCRIBE_DONE_REASON = ObjectValueList<typeof SUBSCRIBE_DONE_REASON>;
export declare const FETCH_ERROR_REASON: {
    readonly INTERNAL_ERROR: 0;
    readonly UNAUTHORIZED: 1;
    readonly TIMEOUT: 2;
    readonly NOT_SUPPORTED: 3;
    readonly TRACK_DOES_NOT_EXIST: 4;
    readonly INVALID_RANGE: 5;
};
export type FETCH_ERROR_REASON = ObjectValueList<typeof FETCH_ERROR_REASON>;
export declare const ANNOUNCE_ERROR_REASON: {
    readonly INTERNAL_ERROR: 0;
    readonly UNAUTHORIZED: 1;
    readonly TIMEOUT: 2;
    readonly NOT_SUPPORTED: 3;
    readonly UNINTERESTED: 4;
};
export type ANNOUNCE_ERROR_REASON = ObjectValueList<typeof ANNOUNCE_ERROR_REASON>;
export declare const SUBSCRIBE_ANNOUNCES_ERROR_REASON: {
    readonly INTERNAL_ERROR: 0;
    readonly UNAUTHORIZED: 1;
    readonly TIMEOUT: 2;
    readonly NOT_SUPPORTED: 3;
    readonly NAMESPACE_PREFIX_UNKNOWN: 4;
};
export type SUBSCRIBE_ANNOUNCES_ERROR_REASON = ObjectValueList<typeof SUBSCRIBE_ANNOUNCES_ERROR_REASON>;
export declare const STREAM: {
    readonly SUBGROUP_HEADER: 4;
    readonly FETCH_HEADER: 5;
};
export declare const DATAGRAM: {
    readonly OBJECT_DATAGRAM: 1;
    readonly OBJECT_DATAGRAM_STATUS: 2;
};
export declare const FETCH_TYPE: {
    readonly STANDALONE: 1;
    readonly JOINING: 2;
};
export type FETCH_TYPE = ObjectValueList<typeof FETCH_TYPE>;
export declare const GROUP_ORDER: {
    readonly ASCENDING: 1;
    readonly DESCENDING: 2;
};
export type GROUP_ORDER = ObjectValueList<typeof GROUP_ORDER>;
export declare const OBJECT_STATUS: {
    readonly NORMAL: 0;
    readonly OBJECT_DOES_NOT_EXIST: 1;
    readonly GROUP_DOES_NOT_EXIST: 2;
    readonly END_OF_GROUP: 3;
    readonly END_OF_TRACK_AND_GROUP: 4;
    readonly END_OF_TRACK: 5;
};
export declare const TRACK_STATUS_CODE: {
    readonly IN_PROGRESS: 0;
    readonly NOT_EXIST: 1;
    readonly NOT_BEGUN: 2;
    readonly FINISHED: 3;
    readonly SENDER_IS_RELAY: 4;
};
export type TRACK_STATUS_CODE = ObjectValueList<typeof TRACK_STATUS_CODE>;
export declare const SUBSCRIBE_FILTER: {
    readonly LATEST_OBJECT: 2;
    readonly ABSOLUTE_START: 3;
    readonly ABSOLUTE_RANGE: 4;
};
export type SUBSCRIBE_FILTER = ObjectValueList<typeof SUBSCRIBE_FILTER>;
export declare const CONTENT_EXISTS: {
    readonly NO: 0;
    readonly YES: 1;
};
export type CONTENT_EXISTS = ObjectValueList<typeof CONTENT_EXISTS>;
export {};
