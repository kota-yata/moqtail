export interface BaseMediaError<K extends string> extends Error {
  name: K;
  message: string;
  shouldCleanup: boolean;
}

export type MediaEncoderError = BaseMediaError<'MediaEncoderError'> & {
  kind: 'video' | 'audio';
};

export type MediaDecoderError = BaseMediaError<'MediaDecoderError'> & {
  kind: 'video' | 'audio';
};

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

