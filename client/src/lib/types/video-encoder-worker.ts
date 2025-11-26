export type VideoEncoderMessageFromMainThread =
  | { type: 'init'; data: Track }
  | { type: 'capture'; data: ReadableStream<VideoFrame> }
  | { type: 'encode'; data: null }
  | { type: 'stop'; data: null };

export type VideoEncoderMessageFromWorker =
  | { type: 'videoChunk'; data: MoqtailVideoChunkMessage }
  | { type: 'error'; data: string };

