import { CONTROL_MESSAGE } from '../constants';
import { readControlMessageType } from '../messages/readControlMessageType';
import { deserializeServerSetup } from '../messages/serverSetup';
import { deserializeAnnounceOk } from '../messages/announceOk';
import { deserializeAnnounceError } from '../messages/announceError';
import { deserializeSubscribe } from '../messages/subscribe';
import { deserializeSubscribeOk } from '../messages/subscribeOk';
import { deserializeSubscribeError } from '../messages/subscribeError';
import { deserializeSubscribeDone } from '../messages/subscribeDone';
import { deserializeUnsubscribe } from '../messages/unsubscribe';
import { deserializeStreamType } from '../utils/stream';
import { STREAM } from '../constants';
import { deserializeSubgroupHeader } from '../dataStreams/subgroupHeader';
import { deserializeSubgroupObjectHeader } from '../dataStreams/subgroupObject';
import { deserializeEncodedChunk } from '../packagers/loc';
import { deserializeDatagramType, deserializeDatagramHeader, DATAGRAM_TYPE } from '../dataStreams/datagram';
import { readStream } from '../utils/stream';
import type { TransportMessageFromMainThread } from './types';

const STATE = {
  STOPPED: 0b0,
  RUNNING: 0b1,
  READING_STREAM: 0b10,
  READING_DATAGRAM: 0b100,
} as const;

class SharedTransportWorker {
  private wt: any;
  private controlStream: any;
  private controlWriter: any;
  private controlReader: any;
  private datagramWriter: any;
  private datagramReader: any;
  private streams: Map<number, any> = new Map();
  private state = 0;
  private options: any = {};

  onMessage(message: MessageEvent<TransportMessageFromMainThread>) {
    const m = message.data;
    switch (m.type) {
      case 'startConnection':
        this.startConnection(m.data.url, m.data.options);
        break;
      case 'sendControlMessage':
        this.sendControlMessage(m.data);
        break;
      case 'createSubgroupStream':
        this.createSubgroupStream(m.data);
        break;
      case 'sendSubgroupObject':
        this.sendSubgroupObject(m.data);
        break;
      case 'sendDatagram':
        this.sendDatagram(m.data);
        break;
      case 'startControlReadLoop':
        this.startControlReadLoop();
        break;
      case 'startStreamReadLoop':
        this.startStreamReadLoop();
        break;
      case 'startDatagramReadLoop':
        this.startDatagramReadLoop();
        break;
      case 'closeSession':
        this.closeSession();
        break;
      default:
        postMessage({ type: 'error', data: { name: 'UnknownThreadMessage', message: String((m as any).type), shouldCleanup: false } });
    }
  }

  async startConnection(url: string, options?: any) {
    try {
      this.options = options || {};
      this.wt = new (self as any).WebTransport(url, { congestionControl: this.options?.congestionControl || 'throughput' });
      await this.wt.ready;
      this.controlStream = await this.wt.createBidirectionalStream({ sendOrder: 100 });
      this.controlWriter = this.controlStream.writable;
      this.controlReader = this.controlStream.readable;
      if (this.options?.enableDatagrams) {
        this.datagramWriter = this.wt.datagrams.writable.getWriter();
        this.datagramReader = this.wt.datagrams.readable.getReader();
        postMessage({ type: 'datagram:max-size', data: this.wt.datagrams.maxDatagramSize });
      }
      this.state = this.state | STATE.RUNNING;
      postMessage({ type: 'session:connected' });
      if (this.options?.autoStartControlRead !== false) this.startControlReadLoop();
      if (this.options?.autoStartStreamRead !== false) this.startStreamReadLoop();
      if (this.options?.autoStartDatagramRead) this.startDatagramReadLoop();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'WTConnectionFailed', message: String(e), shouldCleanup: true } });
    }
  }

  async sendControlMessage(data: Uint8Array) {
    if (this.state === STATE.STOPPED) {
      postMessage({ type: 'error', data: { name: 'SessionClosed', message: 'session is closed', shouldCleanup: true } });
      return;
    }
    try {
      const writer = this.controlWriter.getWriter();
      await writer.write(data);
      writer.releaseLock();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamWriteFailed', message: String(e), shouldCleanup: true } });
    }
  }

  closeSession() {
    this.state = STATE.STOPPED;
    if (this.wt) this.wt.close?.();
    postMessage({ type: 'session:closed' });
  }

  async createSubgroupStream({ subgroupId, subgroupHeader }: { subgroupId: number; subgroupHeader: Uint8Array }) {
    try {
      this.streams.set(subgroupId, (await this.wt.createUnidirectionalStream()).getWriter());
      const writer = this.streams.get(subgroupId);
      await writer.write(subgroupHeader);
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamWriteFailed', message: String(e), shouldCleanup: true } });
    }
  }

  async sendSubgroupObject({ subgroupId, subgroupObject, isLast }: { subgroupObject: Uint8Array; subgroupId: number; isLast?: boolean }) {
    while (!this.streams.has(subgroupId)) {
      await new Promise((r) => setTimeout(r, 0));
    }
    try {
      const writer = this.streams.get(subgroupId);
      await writer.write(subgroupObject);
      if (isLast) {
        await writer.close();
        this.streams.delete(subgroupId);
      }
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamWriteFailed', message: String(e) } });
    }
  }

  async sendDatagram(payload: Uint8Array) {
    try {
      await this.datagramWriter.write(payload);
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'DatagramSendFailed', message: String(e), shouldCleanup: false } });
    }
  }

  async startControlReadLoop() {
    while (this.state & STATE.RUNNING) {
      const msgType = await readControlMessageType(this.controlReader);
      switch (msgType) {
        case CONTROL_MESSAGE.SERVER_SETUP: {
          const m = await deserializeServerSetup(this.controlReader);
          postMessage({ type: 'ctrl:server-setup', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.ANNOUNCE_OK: {
          const m = await deserializeAnnounceOk(this.controlReader);
          postMessage({ type: 'ctrl:announce-ok', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.ANNOUNCE_ERROR: {
          const m = await deserializeAnnounceError(this.controlReader);
          postMessage({ type: 'ctrl:announce-error', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE: {
          const m = await deserializeSubscribe(this.controlReader);
          postMessage({ type: 'ctrl:subscribe', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_OK: {
          const m = await deserializeSubscribeOk(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-ok', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_ERROR: {
          const m = await deserializeSubscribeError(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-error', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_DONE: {
          const m = await deserializeSubscribeDone(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-done', data: m } as any);
          break;
        }
        case CONTROL_MESSAGE.UNSUBSCRIBE: {
          const m = await deserializeUnsubscribe(this.controlReader);
          postMessage({ type: 'ctrl:unsubscribe', data: m } as any);
          break;
        }
        default:
          postMessage({ type: 'error', data: { name: 'UnknownControlMessage', message: String(msgType), shouldCleanup: false } });
      }
    }
  }

  async startStreamReadLoop() {
    if (this.state & STATE.READING_STREAM) return;
    this.state = this.state | STATE.READING_STREAM;
    while (this.state & STATE.READING_STREAM) {
      const reader = this.wt.incomingUnidirectionalStreams.getReader();
      const { value: readableStream, done } = await reader.read();
      if (done || !readableStream) break;
      const headerType = await deserializeStreamType(readableStream);
      switch (headerType) {
        case STREAM.FETCH_HEADER:
          break;
        default:
          const subgroupHeader = await deserializeSubgroupHeader(headerType, readableStream);
          postMessage({ type: 'subgroup:header', data: subgroupHeader } as any);
          this.readSubgroupObject(readableStream, subgroupHeader.trackAlias, subgroupHeader.subgroupId!, subgroupHeader.groupId);
      }
      reader.releaseLock();
    }
  }

  async readSubgroupObject(reader: ReadableStream, trackAlias: number, subgroupId: number, groupId: number) {
    try {
      let done = false;
      while (!done) {
        const header = await deserializeSubgroupObjectHeader(reader);
        const hasStatus = (header as any).objectStatus !== undefined;
        if (!hasStatus) {
          const encodedChunkInit = await deserializeEncodedChunk(reader);
          postMessage({ type: 'subgroup:object', data: { header, encodedChunkInit, trackAlias, subgroupId, groupId } } as any);
        } else {
          postMessage({ type: 'subgroup:object-status', data: { header, subgroupId } } as any);
          done = true;
        }
      }
      await (reader as any).cancel?.();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamReadFailed', message: String(e), shouldCleanup: false } });
    }
  }

  async startDatagramReadLoop() {
    if (this.state & STATE.READING_DATAGRAM) return;
    this.state = this.state | STATE.READING_DATAGRAM;
    while (this.state & STATE.READING_DATAGRAM) {
      const stream = await this.datagramReader.read();
      if (!stream.done) {
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(stream.value);
            controller.close();
          },
          type: 'bytes',
        });
        const datagramType = await deserializeDatagramType(readableStream);
        if (datagramType === DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION || datagramType === DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION) {
          const header = await deserializeDatagramHeader(datagramType, readableStream);
          const payload = await readStream(readableStream, 1024 * 1024);
          postMessage({ type: 'datagram:object', data: { header, payload } } as any, [payload.buffer]);
        } else {
          // Status datagrams are ignored for now.
        }
      }
    }
  }
}

const workerInstance = new SharedTransportWorker();
self.addEventListener('message', workerInstance.onMessage.bind(workerInstance));

export {};

const postMessage: (message: any, transfer?: Transferable[]) => void = (message: any, transfer?: Transferable[]) => {
  (self as any).postMessage(message, transfer as any);
};
