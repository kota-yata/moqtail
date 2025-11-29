import type { TransportError } from 'moqtail';
import type { MediaDecoderError } from '$lib/types/media-error';
import type { Subscribe } from 'moqtail';

export type AudioDecoderMessageFromMainThread =
  | { type: 'init'; data: Subscribe }
  | { type: 'decode'; data: { encodedAudioChunk: EncodedAudioChunk; config?: AudioDecoderConfig } };

export type AudioDecoderMessageFromWorker =
  | { type: 'audioData'; data: { audioData: AudioData } }
  | { type: 'error'; data: TransportError | MediaDecoderError };
