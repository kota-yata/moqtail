export type AudioEncoderMessageFromMainThread =
  | { type: 'init'; data: Track }
  | { type: 'capture'; data: ReadableStream<AudioData> }
  | { type: 'encode'; data: null }
  | { type: 'stop'; data: null };

export type AudioEncoderMessageFromWorker =
  | { type: 'audioChunk'; data: MoqtailAudioChunkMessage }
  | { type: 'error'; data: string };

