import type { TransportError } from 'moqtail';
import type { MediaDecoderError } from '$lib/types/media-error';
import type { Subscribe } from 'moqtail';

export type VideoDecoderMessageFromMainThread =
  | { type: 'init'; data: Subscribe }
  | { type: 'decode'; data: { encodedVideoChunk: EncodedVideoChunk; config?: VideoDecoderConfig } };

export type VideoDecoderMessageFromWorker =
  | { type: 'videoFrame'; data: { requestId: number; frame: VideoFrame } }
  | { type: 'error'; data: TransportError | MediaDecoderError };
