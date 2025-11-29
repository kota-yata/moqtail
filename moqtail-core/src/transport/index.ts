import type { MoqTransport, TransportEvent, TransportMessageFromMainThread, TransportOptions } from './types';

export type * from './types';
export type * from './error';
export {
  makeSessionClosedError,
  makeWTConnectionFailedError,
  makeUnknownControlMessageError,
  makeUnknownThreadMessageError,
  makeStreamWriteFailedError,
  makeStreamReadFailedError,
  makeDatagramSendFailedError,
} from './error';
export { createTypedWorker } from '../utils/typedWorker';
export { getTransportWorkerURL } from './worker-url';

/**
 * Merge user-provided options with transport defaults.
 */
function defaults(opts?: Partial<TransportOptions>): TransportOptions {
  return {
    role: 'subscriber',
    enableDatagrams: false,
    autoStartControlRead: true,
    autoStartStreamRead: true,
    autoStartDatagramRead: false,
    congestionControl: 'throughput',
    ...(opts || {}),
  };
}

/**
 * Create a typed transport facade bound to a dedicated Worker.
 * The returned API delegates to the worker via `postMessage`.
 */
export function createTransport(worker: Worker, base?: Partial<TransportOptions>): MoqTransport {
  const baseOptions = defaults(base);

  const post = (msg: TransportMessageFromMainThread, transfer?: Transferable[]) => worker.postMessage(msg, transfer);

  const api: MoqTransport = {
    /** @inheritdoc MoqTransport.connect */
    async connect(url, opts) {
      const options = { ...baseOptions, ...(opts || {}) };
      post({ type: 'startConnection', data: { url, options } });
    },
    /** @inheritdoc MoqTransport.close */
    async close() {
      post({ type: 'closeSession', data: null });
    },
    /** @inheritdoc MoqTransport.sendControlMessage */
    async sendControlMessage(payload) {
      post({ type: 'sendControlMessage', data: payload });
    },
    /** @inheritdoc MoqTransport.startControlReadLoop */
    startControlReadLoop() {
      post({ type: 'startControlReadLoop', data: null });
    },
    /** @inheritdoc MoqTransport.startStreamReadLoop */
    startStreamReadLoop() {
      post({ type: 'startStreamReadLoop', data: null });
    },
    /** @inheritdoc MoqTransport.createSubgroupStream */
    async createSubgroupStream(input) {
      post({ type: 'createSubgroupStream', data: input });
    },
    /** @inheritdoc MoqTransport.sendSubgroupObject */
    async sendSubgroupObject(input) {
      post({ type: 'sendSubgroupObject', data: input }, [input.subgroupObject.buffer]);
    },
    /** @inheritdoc MoqTransport.sendDatagram */
    async sendDatagram(payload) {
      post({ type: 'sendDatagram', data: payload }, [payload.buffer]);
    },
    /** @inheritdoc MoqTransport.startDatagramReadLoop */
    startDatagramReadLoop() {
      post({ type: 'startDatagramReadLoop', data: null });
    },
    /** @inheritdoc MoqTransport.on */
    on(type, handler) {
      const listener = (ev: MessageEvent<TransportEvent>) => {
        const msg = ev.data;
        if (msg && msg.type === type) handler(msg as any);
      };
      worker.addEventListener('message', listener as any);
      return () => worker.removeEventListener('message', listener as any);
    },
  };

  return api;
}
