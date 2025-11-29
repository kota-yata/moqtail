import type { MoqTransport, TransportEvent, TransportMessageFromMainThread, TransportOptions } from './types';

export type { MoqTransport, TransportEvent, TransportOptions } from './types';
export { createTypedWorker } from '../utils/typedWorker';
export { getTransportWorkerURL } from './worker-url';

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

export function createTransport(worker: Worker, base?: Partial<TransportOptions>): MoqTransport {
  const baseOptions = defaults(base);

  const post = (msg: TransportMessageFromMainThread, transfer?: Transferable[]) => worker.postMessage(msg, transfer);

  const api: MoqTransport = {
    async connect(url, opts) {
      const options = { ...baseOptions, ...(opts || {}) };
      post({ type: 'startConnection', data: { url, options } });
    },
    async close() {
      post({ type: 'closeSession', data: null });
    },
    async sendControlMessage(payload) {
      post({ type: 'sendControlMessage', data: payload });
    },
    startControlReadLoop() {
      post({ type: 'startControlReadLoop', data: null });
    },
    startStreamReadLoop() {
      post({ type: 'startStreamReadLoop', data: null });
    },
    async createSubgroupStream(input) {
      post({ type: 'createSubgroupStream', data: input });
    },
    async sendSubgroupObject(input) {
      post({ type: 'sendSubgroupObject', data: input }, [input.subgroupObject.buffer]);
    },
    async sendDatagram(payload) {
      post({ type: 'sendDatagram', data: payload }, [payload.buffer]);
    },
    startDatagramReadLoop() {
      post({ type: 'startDatagramReadLoop', data: null });
    },
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
