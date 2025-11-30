// @ts-ignore - resolved by Vite's ?worker at build time
import DecoderWorker from './decoder.worker?worker';
import { createTypedWorker } from 'moqtail';
import type { VideoDecoderMessageFromMainThread, VideoDecoderMessageFromWorker } from '$lib/types/video-decoder-worker';

const TypedVideoDecoderWorker = createTypedWorker<VideoDecoderMessageFromMainThread, VideoDecoderMessageFromWorker>(DecoderWorker);

export default TypedVideoDecoderWorker;

