// @ts-ignore - resolved by Vite's ?worker at build time
import EncoderWorker from './encoder.worker?worker';
import { createTypedWorker } from 'moqtail';
import type { AudioEncoderMessageFromMainThread, AudioEncoderMessageFromWorker } from '$lib/types/audio-encoder-worker';

const TypedAudioEncoderWorker = createTypedWorker<AudioEncoderMessageFromMainThread, AudioEncoderMessageFromWorker>(EncoderWorker);

export default TypedAudioEncoderWorker;

