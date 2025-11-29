export interface BaseTransportError<K extends string> extends Error {
  name: K;
  message: string;
  shouldCleanup: boolean;
}

// Generic transport/session errors
export type SessionClosedError = BaseTransportError<'SessionClosedError'>;
export type WTConnectionFailedError = BaseTransportError<'WTConnectionFailedError'>;
export type UnknownControlMessageError = BaseTransportError<'UnknownControlMessageError'> & {
  code?: number; // code of the unknown control message
};
export type UnknownThreadMessageError = BaseTransportError<'UnknownThreadMessageError'> & {
  messageType?: string; // type of the unknown thread message
};
export type StreamWriteFailedError = BaseTransportError<'StreamWriteFailedError'>;
export type StreamReadFailedError = BaseTransportError<'StreamReadFailedError'>;

// Media pipeline errors
export type MediaEncoderError = BaseTransportError<'MediaEncoderError'> & {
  kind: 'video' | 'audio';
};
export type MediaDecoderError = BaseTransportError<'MediaDecoderError'> & {
  kind: 'video' | 'audio';
};

export type TransportError =
  | SessionClosedError
  | WTConnectionFailedError
  | UnknownControlMessageError
  | UnknownThreadMessageError
  | StreamWriteFailedError
  | StreamReadFailedError
  | MediaEncoderError
  | MediaDecoderError;

export const makeSessionClosedError = (
  message: string,
  opts?: { shouldCleanup?: boolean }
): SessionClosedError => ({
  name: 'SessionClosedError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
});

export const makeWTConnectionFailedError = (
  message: string,
  opts?: { shouldCleanup?: boolean }
): WTConnectionFailedError => ({
  name: 'WTConnectionFailedError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
});

export const makeUnknownControlMessageError = (
  message: string,
  opts: { code: number; shouldCleanup?: boolean }
): UnknownControlMessageError => ({
  name: 'UnknownControlMessageError',
  message,
  shouldCleanup: opts.shouldCleanup ?? false,
  code: opts.code,
});

export const makeUnknownThreadMessageError = (
  message: string,
  opts: { messageType: string; shouldCleanup?: boolean }
): UnknownThreadMessageError => ({
  name: 'UnknownThreadMessageError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
  messageType: opts.messageType,
});

export const makeStreamWriteFailedError = (
  message: string,
  opts?: { shouldCleanup?: boolean }
): StreamWriteFailedError => ({
  name: 'StreamWriteFailedError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
});

export const makeStreamReadFailedError = (
  message: string,
  opts?: { shouldCleanup?: boolean }
): StreamReadFailedError => ({
  name: 'StreamReadFailedError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
});

export const makeMediaEncoderError = (
  message: string,
  opts: { kind: 'video' | 'audio'; shouldCleanup?: boolean }
): MediaEncoderError => ({
  name: 'MediaEncoderError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
  kind: opts.kind,
});

export const makeMediaDecoderError = (
  message: string,
  opts: { kind: 'video' | 'audio'; shouldCleanup?: boolean }
): MediaDecoderError => ({
  name: 'MediaDecoderError',
  message,
  shouldCleanup: opts?.shouldCleanup ?? false,
  kind: opts.kind,
});

