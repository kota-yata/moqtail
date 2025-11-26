// @ts-ignore - resolved by Vite's ?worker at build time
import CommunicatorWorker from './communicator.worker?worker';
import { createTypedWorker } from '$lib/utils/typedWorker';
import type { CommunicatorMessageFromMainThread, CommunicatorMessageFromWorker } from '$lib/types/communicator-worker';

const TypedCommunicatorWorker = createTypedWorker<CommunicatorMessageFromMainThread, CommunicatorMessageFromWorker>(CommunicatorWorker);

export default TypedCommunicatorWorker;

