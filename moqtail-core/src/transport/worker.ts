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
import type { RX_OBJECT_MODE, TransportMessageFromMainThread } from './types';
import { buffRead } from 'bytes';

const STATE = {
  STOPPED: 0b0,
  RUNNING: 0b1,
  READING_STREAM: 0b10,
  READING_DATAGRAM: 0b100,
} as const;

class SharedTransportWorker {
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;
  private datagramWriter: WritableStreamDefaultWriter;
  private datagramReader: ReadableStreamDefaultReader;
  private streams: Map<number, WritableStreamDefaultWriter> = new Map();
  private state = 0;
  private objectMode: RX_OBJECT_MODE = 'normal';

  /**
   * Handle incoming messages from the main thread. **This is not supposed to be called externally**
   * @param message 
   */
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
        this.startStreamReadLoop(m.data);
        break;
      case 'startDatagramReadLoop':
        this.startDatagramReadLoop();
        break;
      case 'closeSession':
        this.closeSession();
        break;
      default:
        postMessage({ type: 'error', data: { name: 'UnknownThreadMessageError', message: String((m as any).type), shouldCleanup: false } });
    }
  }

  /**
   * Start a WebTransport connection to the given URL.
   * @param url WebTransport server URL
   * @param options Connection options
   */
  async startConnection(
    url: string,
    options?: {
      enableDatagrams?: boolean;
      autoStartControlRead?: boolean;
      congestionControl?: WebTransportCongestionControl;
    }
  ) {
    try {
      this.wt = new WebTransport(url, { congestionControl: options?.congestionControl || 'throughput' });
      await this.wt.ready;
      this.controlStream = await this.wt.createBidirectionalStream({ sendOrder: 100 });
      this.controlWriter = this.controlStream.writable;
      this.controlReader = this.controlStream.readable;
      if (options?.enableDatagrams) {
        this.datagramWriter = this.wt.datagrams.writable.getWriter();
        this.datagramReader = this.wt.datagrams.readable.getReader();
        postMessage({ type: 'datagram:max-size', data: this.wt.datagrams.maxDatagramSize });
      }
      this.state = this.state | STATE.RUNNING;
      postMessage({ type: 'session:connected' });
      if (options?.autoStartControlRead) this.startControlReadLoop();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'WTConnectionFailedError', message: String(e), shouldCleanup: true } });
    }
  }

  /**
   * Send a serialized control message to the server.
   * @param data Serialized control message
   * @returns 
   */
  async sendControlMessage(data: Uint8Array) {
    if (this.state === STATE.STOPPED) {
      postMessage({ type: 'error', data: { name: 'SessionClosedError', message: 'session is closed', shouldCleanup: true } });
      return;
    }
    try {
      const writer = this.controlWriter.getWriter();
      await writer.write(data);
      writer.releaseLock();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamWriteFailedError', message: String(e), shouldCleanup: true } });
    }
  }

  /**
   * Explicitly close the WebTransport session.
   */
  closeSession() {
    this.state = STATE.STOPPED;
    // Ignore errors during close since we're shutting down anyway.
    try { if (this.wt) this.wt.close(); } catch {}
    postMessage({ type: 'session:closed' });
  }

  /**
   * Open a unidirectional stream for the given subgroup and write its header.
   * @param param0 SubgroupId and serialized subgroup header
   */
  async createSubgroupStream({ subgroupId, subgroupHeader }: { subgroupId: number; subgroupHeader: Uint8Array }) {
    try {
      this.streams.set(subgroupId, (await this.wt.createUnidirectionalStream()).getWriter());
      const writer = this.streams.get(subgroupId);
      await writer.write(subgroupHeader);
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamWriteFailedError', message: String(e), shouldCleanup: true } });
    }
  }

  /**
   * Send a serialized subgroup object over the corresponding subgroup stream.
   * @param param0 SubgroupId, serialized subgroup object, and optional flag indicating if this is the last object
   */
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
      postMessage({ type: 'error', data: { name: 'StreamWriteFailedError', message: String(e), shouldCleanup: true } });
    }
  }

  /**
   * Send a serialized datagram to the server.
   * @param payload Serialized datagram payload
   */
  async sendDatagram(payload: Uint8Array) {
    try {
      await this.datagramWriter.write(payload);
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'DatagramSendFailedError', message: String(e), shouldCleanup: false } });
    }
  }

  /**
   * Start the control message read loop.
   */
  async startControlReadLoop() {
    while (this.state & STATE.RUNNING) {
      const msgType = await readControlMessageType(this.controlReader);
      switch (msgType) {
        case CONTROL_MESSAGE.SERVER_SETUP: {
          const m = await deserializeServerSetup(this.controlReader);
          postMessage({ type: 'ctrl:server-setup', data: m });
          break;
        }
        case CONTROL_MESSAGE.ANNOUNCE_OK: {
          const m = await deserializeAnnounceOk(this.controlReader);
          postMessage({ type: 'ctrl:announce-ok', data: m });
          break;
        }
        case CONTROL_MESSAGE.ANNOUNCE_ERROR: {
          const m = await deserializeAnnounceError(this.controlReader);
          postMessage({ type: 'ctrl:announce-error', data: m });
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE: {
          const m = await deserializeSubscribe(this.controlReader);
          postMessage({ type: 'ctrl:subscribe', data: m });
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_OK: {
          const m = await deserializeSubscribeOk(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-ok', data: m });
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_ERROR: {
          const m = await deserializeSubscribeError(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-error', data: m });
          break;
        }
        case CONTROL_MESSAGE.SUBSCRIBE_DONE: {
          const m = await deserializeSubscribeDone(this.controlReader);
          postMessage({ type: 'ctrl:subscribe-done', data: m });
          break;
        }
        case CONTROL_MESSAGE.UNSUBSCRIBE: {
          const m = await deserializeUnsubscribe(this.controlReader);
          postMessage({ type: 'ctrl:unsubscribe', data: m });
          break;
        }
        default:
          postMessage({ type: 'error', data: { name: 'UnknownControlMessageError', message: String(msgType), shouldCleanup: false } });
      }
    }
  }

  /**
   * Start the stream read loop.
   * @param mode Mode for receiving objects ('normal' or 'encodedChunk')
   */
  async startStreamReadLoop(input: { mode?: RX_OBJECT_MODE } = {}) {
    if (this.state & STATE.READING_STREAM) return;
    this.state = this.state | STATE.READING_STREAM;
    this.objectMode = input.mode ?? 'normal';
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
          postMessage({ type: 'subgroup:header', data: subgroupHeader });
          this.readSubgroupObject(readableStream, subgroupHeader.trackAlias, subgroupHeader.subgroupId!, subgroupHeader.groupId);
      }
      reader.releaseLock();
    }
  }

  private async readSubgroupObject(reader: ReadableStream, trackAlias: number, subgroupId: number, groupId: number) {
    try {
      let done = false;
      while (!done) {
        const header = await deserializeSubgroupObjectHeader(reader);
        const hasStatus = header.objectStatus !== undefined;
        if (!hasStatus) {
          //TODO: Support both modes in a more elegant way.
          // Currently, the worker switches between two modes based on the first call to `startStreamReadLoop`.
          // This flow prevents mixing both modes simultaneously, meaning having different subgroup streams in different modes.
          if (this.objectMode === 'encodedChunk') {
            const encodedChunkInit = await deserializeEncodedChunk(reader);
            postMessage({ type: 'subgroup:media-object', data: { header, encodedChunkInit, trackAlias, subgroupId, groupId } });
          } else {
            if (!header.payloadLength) {
              postMessage({ type: 'error', data: { name: 'StreamReadFailedError', message: 'payloadLength is missing when reading a normal subgroup object', shouldCleanup: false } });
            }
            const payload = await buffRead(reader, header.payloadLength);
            postMessage({ type: 'subgroup:object', data: { header, payload, trackAlias, subgroupId, groupId } }, [payload.buffer]);
          }
        } else {
          postMessage({ type: 'subgroup:object-status', data: { header, subgroupId } });
          done = true;
        }
      }
      await reader.cancel();
    } catch (e) {
      postMessage({ type: 'error', data: { name: 'StreamReadFailedError', message: String(e), shouldCleanup: false } });
    }
  }

  /**
   * Start the datagram read loop. 
   */
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
          postMessage({ type: 'datagram:object', data: { header, payload } }, [payload.buffer]);
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
  self.postMessage(message, void 0, transfer);
};
