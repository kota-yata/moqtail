import { Logger } from 'tslog';
import { CONTROL_MESSAGE, deserializeAnnounceError, deserializeAnnounceOk, deserializeDatagramHeader, deserializeDatagramType, deserializeEncodedChunk, deserializeServerSetup, deserializeSubgroupHeader, deserializeSubgroupObjectHeader, deserializeSubscribe, deserializeSubscribeDone, deserializeSubscribeError, deserializeSubscribeOk, deserializeUnsubscribe, OBJECT_STATUS, readControlMessageType, STREAM, readStream, DATAGRAM_TYPE, deserializeStreamType } from 'moqtail';
import { makeSessionClosedError, makeStreamReadFailedError, makeStreamWriteFailedError, makeUnknownControlMessageError, makeUnknownThreadMessageError, makeWTConnectionFailedError } from '$lib/types/error';

export const COMMUNICATOR_STATE = {
  STOPPED: 0b0,
  RUNNING: 0b1,
  READING_STREAM: 0b10,
  READING_DATAGRAM: 0b100
} as const;

class MoQTCommunicator {
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;
  private datagramWriter: WritableStreamDefaultWriter;
  private datagramReader: ReadableStreamDefaultReader;
  private streams: Map<number, WritableStreamDefaultWriter> = new Map();
  private state = 0;
  onMessage(message: MessageEvent) {
    const data = message.data as ThreadMessage;
    const handlers: { [key: string]: (data: any) => void } = {
      startConnection: this.startConnection.bind(this),
      sendControlMessage: this.sendControlMessage.bind(this),
      createSubgroupStream: this.createSubgroupStream.bind(this),
      sendSubgroupObject: this.sendObject.bind(this),
      sendDatagram: this.sendDatagram.bind(this),
      closeSession: this.closeSession.bind(this),
      startReadLoop: this.startReadLoop.bind(this),
      startStreamReadLoop: this.startStreamReadLoop.bind(this),
      startDatagramReadLoop: this.startDatagramReadLoop.bind(this)
    };
    const handler = handlers[data.type];
    if (!handler) {
      const err = makeUnknownThreadMessageError('Unknown thread message type', { messageType: data.type, shouldCleanup: false });
      postMessage({ type: 'error', data: err });
      return;
    }
    handler(data.data);
  }
  async startConnection(url: string) {
    try {
      this.wt = new WebTransport(url, { congestionControl: 'throughput' });
      await this.wt.ready;
      this.controlStream = await this.wt.createBidirectionalStream({ sendOrder: 100 });
      this.controlWriter = this.controlStream.writable;
      this.controlReader = this.controlStream.readable;
      this.datagramWriter = this.wt.datagrams.writable.getWriter();
      this.datagramReader = this.wt.datagrams.readable.getReader();
      this.state = this.state | COMMUNICATOR_STATE.RUNNING;
      postMessage({ type: 'datagramMaxSize', data: this.wt.datagrams.maxDatagramSize });
    } catch (e) {
      const err = makeWTConnectionFailedError(`WebTransport connection failed: ${e}`, { shouldCleanup: true });
      postMessage({ type: 'error', data: err });
    }
  }
  async sendControlMessage(data: Uint8Array) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      const err = makeSessionClosedError('Cannot send control message: session is closed', { shouldCleanup: true });
      postMessage({ type: 'error', data: err });
      return;
    }
    try {
      const writer = this.controlWriter.getWriter();
      await writer.write(data);
      writer.releaseLock();
    } catch (err) {
      const e = makeStreamWriteFailedError(`Error sending control message: ${err}`, { shouldCleanup: true });
      postMessage({ type: 'error', data: e });
    }
    logger.debug('Control message sent');
  }
  async createSubgroupStream({ subgroupId, subgroupHeader }: { subgroupId: number, subgroupHeader: Uint8Array }) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      const err = makeSessionClosedError('Cannot create subgroup stream: session is closed', { shouldCleanup: true });
      postMessage({ type: 'error', data: err });
      return;
    }
    try {
      this.streams.set(subgroupId, (await this.wt.createUnidirectionalStream()).getWriter());
      const writer = this.streams.get(subgroupId);
      await writer.write(subgroupHeader);
      logger.debug('Stream created');
    } catch (err) {
      const e = makeStreamWriteFailedError(`Error creating subgroup stream: ${err}`, { shouldCleanup: true });
      postMessage({ type: 'error', data: e });
    }
  }
  async sendObject({ subgroupObject, subgroupId, isLast }: { subgroupObject: Uint8Array, subgroupId: number, isLast?: boolean }) {
    // if (!this.streams.has(subgroupId)) {
    //   postMessage({ type: 'error', data: `Stream ${subgroupId} not found` });
    //   return;
    // }
    while (!this.streams.has(subgroupId)) {
      await new Promise((resolve) => setTimeout(resolve, 0.1));
    };
    try {
      const writer = this.streams.get(subgroupId);
      await writer.write(subgroupObject);
      if (isLast) {
        await writer.close();
        this.streams.delete(subgroupId);
        logger.debug(`Stream ${subgroupId} closed`);
      }
    } catch (err) {
      const e = makeStreamWriteFailedError(`Error sending subgroup object: ${err}`, { shouldCleanup: true });
      postMessage({ type: 'error', data: e });
    }
  }
  async sendDatagram(data: Uint8Array) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      const err = makeSessionClosedError('Cannot send datagram: session is closed', { shouldCleanup: true });
      postMessage({ type: 'error', data: err });
      return;
    }
    try {
      await this.datagramWriter.write(data);
    } catch (err) {
      const e = makeStreamWriteFailedError(`Error sending datagram: ${err}`, { shouldCleanup: true });
      postMessage({ type: 'error', data: e });
    }
  }
  closeSession() {
    this.state = COMMUNICATOR_STATE.STOPPED;
    this.wt.close();
    postMessage({ type: 'sessionClosed' });
  }
  async readSubgroupObject(reader: ReadableStream, trackAlias: number, subgroupId: number, groupId: number) {
    try {
      let done = false;
      while (!done) {
        const header = await deserializeSubgroupObjectHeader(reader);
        done = header.objectStatus && (header.objectStatus === OBJECT_STATUS.END_OF_GROUP || header.objectStatus === OBJECT_STATUS.END_OF_TRACK || header.objectStatus === OBJECT_STATUS.END_OF_TRACK_AND_GROUP);
        if (!done) {
          const encodedChunkInit = await deserializeEncodedChunk(reader);
          postMessage({ type: 'subgroupObject', data: { header, encodedChunkInit, trackAlias, subgroupId, groupId } });
        } else {
          postMessage({ type: 'subgroupObjectStatus', data: { header, subgroupId } });
        }
      }
      await reader.cancel();
    } catch (err) {
      const e = makeStreamReadFailedError(`Error reading subgroup object: ${err}`, { shouldCleanup: false });
      postMessage({ type: 'error', data: e });
    }
  }
  async readDatagramObject(reader: ReadableStream) {
    const datagramType = await deserializeDatagramType(reader);
    switch (datagramType) {
      case DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION:
      case DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION:
        const header = await deserializeDatagramHeader(datagramType, reader);
        const payload = await readStream(reader, 1024);
        postMessage({ type: 'datagramObject', data: { header, payload } }, [payload.buffer]);
        break;
      case DATAGRAM_TYPE.DATAGRAM_STATUS_WITHOUT_EXTENSION:
      case DATAGRAM_TYPE.DATAGRAM_STATUS_WITH_EXTENSION:
        logger.debug('Datagram status received');
        // TODO: implement object status handling
        break;
    }
  }
  async startReadLoop() {
    while (this.state & COMMUNICATOR_STATE.RUNNING) {
      const msgType = await readControlMessageType(this.controlReader);
      switch (msgType) {
      case CONTROL_MESSAGE.SERVER_SETUP: {
        const message = await deserializeServerSetup(this.controlReader);
        postMessage({ type: 'ctrl-server-setup', data: message });
        break;
      }
      case CONTROL_MESSAGE.ANNOUNCE_OK: {
        const message = await deserializeAnnounceOk(this.controlReader);
        postMessage({ type: 'ctrl-announce-ok', data: message });
        break;
      }
      case CONTROL_MESSAGE.ANNOUNCE_ERROR: {
        const message = await deserializeAnnounceError(this.controlReader);
        postMessage({ type: 'ctrl-announce-error', data: message });
        break;
      }
      case CONTROL_MESSAGE.SUBSCRIBE: {
        const message = await deserializeSubscribe(this.controlReader);
        postMessage({ type: 'ctrl-subscribe', data: message });
        break;
      }
      case CONTROL_MESSAGE.SUBSCRIBE_OK: {
        const message = await deserializeSubscribeOk(this.controlReader);
        postMessage({ type: 'ctrl-subscribe-ok', data: message });
        break;
      }
      case CONTROL_MESSAGE.SUBSCRIBE_ERROR: {
        const message = await deserializeSubscribeError(this.controlReader);
        postMessage({ type: 'ctrl-subscribe-error', data: message });
        break;
      }
      case CONTROL_MESSAGE.SUBSCRIBE_DONE: {
        const message = await deserializeSubscribeDone(this.controlReader);
        postMessage({ type: 'ctrl-subscribe-done', data: message });
        break;
      }
      case CONTROL_MESSAGE.UNSUBSCRIBE: {
        const message = await deserializeUnsubscribe(this.controlReader);
        postMessage({ type: 'ctrl-unsubscribe', data: message });
        break;
      }
      default: {
        const e = makeUnknownControlMessageError(`Unknown control message type: ${msgType}`, { code: msgType, shouldCleanup: false });
        postMessage({ type: 'error', data: e });
      }
      }
    }
  }
  async startStreamReadLoop() {
    if (this.state & COMMUNICATOR_STATE.READING_STREAM) {
      logger.debug('duplicated startStreamReadLoop call. aborting');
      return;
    }
    this.state = this.state | COMMUNICATOR_STATE.READING_STREAM;
    while (this.state & COMMUNICATOR_STATE.READING_STREAM) {
      const reader = this.wt.incomingUnidirectionalStreams.getReader();
      const { value: readableStream, done } = await reader.read();
      if (done || !readableStream) {
        logger.error('Stream reader closed');
        break;
      }
      const headerType = await deserializeStreamType(readableStream);
      switch (headerType) {
        case STREAM.FETCH_HEADER:
          logger.debug('Fetch header received');
          break;
        default:
          const subgroupHeader = await deserializeSubgroupHeader(headerType, readableStream);
          postMessage({ type: `subgroup-header`, data: subgroupHeader });
          this.readSubgroupObject(readableStream, subgroupHeader.trackAlias, subgroupHeader.subgroupId, subgroupHeader.groupId);
      }
      reader.releaseLock();
    }
  }
  async startDatagramReadLoop() {
    if (this.state & COMMUNICATOR_STATE.READING_DATAGRAM) {
      logger.debug('duplicated startDatagramReadLoop call. aborting');
      return;
    }
    this.state = this.state | COMMUNICATOR_STATE.READING_DATAGRAM;
    while (this.state & COMMUNICATOR_STATE.READING_DATAGRAM) {
      const stream = await this.datagramReader.read();
      if (!stream.done) {
        // Create a BYOT capable reader for the data by reading whole datagram
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(stream.value);
            controller.close();
          },
          type: 'bytes',
        });
        // TODO: the ideal structure is doing below outside of communicator worker as this is not communicator's scope to parse message
        // currently parsing here because I haven't found the way to pass readableStream correctly without causing non-byte stream error
        this.readDatagramObject(readableStream);
      }
    }
  }
}

const workerInstance = new MoQTCommunicator();
self.addEventListener('message', workerInstance.onMessage.bind(workerInstance));

export {};
const logger = new Logger({ name: 'CommunicatorWorker' });
