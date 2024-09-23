export declare const MOQ_DRAFT01_VERSION = 4278190081;
export declare const MOQ_DRAFT04_VERSION = 4278190084;
export declare const MOQ_DRAFT05_VERSION = 4278190085;
export declare const MOQ_SUPPORTED_VERSIONS: number[];
export declare const MOQ_PARAMETER_ROLE: {
    KEY: number;
    PUBLISHER: number;
    SUBSCRIBER: number;
    PUBSUB: number;
};
export declare const MOQ_PARAMETER_PATH: {
    KEY: number;
};
export declare const MOQ_PARAMETER_AUTHORIZATION_INFO = 2;
export declare const MOQ_MAX_PARAMS = 256;
export declare const MOQ_MAX_ARRAY_LENGTH = 1024;
export declare const MOQ_LOCATION_MODE_NONE = 0;
export declare const MOQ_LOCATION_MODE_ABSOLUTE = 1;
export declare const MOQ_LOCATION_MODE_RELATIVE_PREVIOUS = 2;
export declare const MOQ_LOCATION_MODE_RELATIVE_NEXT = 3;
export declare const MOQ_MESSAGE: {
    OBJECT_STREAM: number;
    OBJECT_DATAGRAM: number;
    CLIENT_SETUP: number;
    SERVER_SETUP: number;
    SUBSCRIBE: number;
    SUBSCRIBE_OK: number;
    SUBSCRIBE_ERROR: number;
    SUBSCRIBE_DONE: number;
    UNSUBSCRIBE: number;
    ANNOUNCE: number;
    ANNOUNCE_OK: number;
    ANNOUNCE_ERROR: number;
    ANNOUNCE_CANCEL: number;
    UNANNOUNCE: number;
    GOAWAY: number;
    TRACK_STATUS_REQUEST: number;
    TRACK_STATUS: number;
    STREAM_HEADER_TRACK: number;
    STREAM_HEADER_GROUP: number;
};
export declare const MOQ_SESSION_CLOSE_ERROR: {
    NO_ERROR: number;
    INTERNAL_ERROR: number;
    UNAUTHORIZED: number;
    PROTOCOL_VIOLATION: number;
    DUPLICATE_TRACK_ALIAS: number;
    PARAMETER_LENGTH_MISMATCH: number;
    GOAWAY_TIMEOUT: number;
};
export declare const SUBSCRIBE_ERROR: {
    INTERNAL_ERROR: number;
    INVALID_RANGE: number;
    RETRY_TRACK_ALIAS: number;
};
export declare const SUBSCRIBE_DONE: {
    UNSUBSCRIBED: number;
    INTERNAL_ERROR: number;
    UNAUTHORIZED: number;
    TRACK_ENDED: number;
    SUBSCRIPTION_ENDED: number;
    GOING_AWAY: number;
    EXPIRED: number;
};
export declare const SUBSCRIBE_FILTER: {
    LATEST_GROUP: number;
    LATEST_OBEJCT: number;
    ABSOLUTE_START: number;
    ABSOLUTE_RANGE: number;
};
export declare const SUBSCRIBE_GROUP_ORDER: {
    ASCENDING: number;
    DESCENDING: number;
};
export declare const OBJECT_STATUS: {
    NORMAL: number;
    NON_EXISTENT_OBJECT: number;
    NON_EXISTENT_GROUP: number;
    END_OF_GROUP: number;
    END_OF_TRACK_AND_GROUP: number;
};
