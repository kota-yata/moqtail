// @ts-ignore - resolved by Vite's ?worker at build time
import EncoderWorker from './encoder.worker?worker';
import { createTypedWorker } from '$lib/utils/typedWorker';
import type { VideoEncoderMessageFromMainThread, VideoEncoderMessageFromWorker } from '$lib/types/video-encoder-worker';

const TypedVideoEncoderWorker = createTypedWorker<VideoEncoderMessageFromMainThread, VideoEncoderMessageFromWorker>(EncoderWorker);

export default TypedVideoEncoderWorker;

