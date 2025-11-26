// @ts-ignore - resolved by Vite's ?worker at build time
import DecoderWorker from './decoder.worker?worker';
import { createTypedWorker } from '$lib/utils/typedWorker';
import type { AudioDecoderMessageFromMainThread, AudioDecoderMessageFromWorker } from '$lib/types/audio-decoder-worker';

const TypedAudioDecoderWorker = createTypedWorker<AudioDecoderMessageFromMainThread, AudioDecoderMessageFromWorker>(DecoderWorker);

export default TypedAudioDecoderWorker;

