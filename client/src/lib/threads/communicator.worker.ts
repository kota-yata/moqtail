import { Mogger } from '$lib/utils/mogger';
import { CONTROL_MESSAGE, DATAGRAM, deserializeAnnounceError, deserializeAnnounceOk, deserializeDatagramHeader, deserializeDatagramType, deserializeEncodedChunk, deserializeServerSetup, deserializeSubgroupHeader, deserializeSubgroupObjectHeader, deserializeSubscribe, deserializeSubscribeDone, deserializeSubscribeError, deserializeSubscribeOk, deserializeUnsubscribe, OBJECT_STATUS, readControlMessageType, STREAM } from 'moqtail';

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
  private datagramWriter: WritableStream;
  private datagramReader: ReadableStreamDefaultReader;
  private streams: Map<number, WritableStream> = new Map();
  private state = 0;
  onMessage(message: MessageEvent) {
    const data = message.data as ThreadMessage;
    const handlers: { [key: string]: (data: any) => void } = {
      startConnection: this.startConnection.bind(this),
      sendControlMessage: this.sendControlMessage.bind(this),
      createSubgroupStream: this.createSubgroupStream.bind(this),
      closeSubgroupStreams: this.closeSubgroupStreams.bind(this),
      sendSubgroupObject: this.sendObject.bind(this),
      sendDatagram: this.sendDatagram.bind(this),
      closeStream: this.closeSubgroupStream.bind(this),
      closeSession: this.closeSession.bind(this),
      startReadLoop: this.startReadLoop.bind(this),
      startStreamReadLoop: this.startStreamReadLoop.bind(this),
      startDatagramReadLoop: this.startDatagramReadLoop.bind(this)
    };
    const handler = handlers[data.type];
    if (!handler) {
      postMessage({ type: 'error', data: `Unknown message type: ${data.type}` });
      return;
    }
    handler(data.data);
  }
  async startConnection(url: string) {
    this.wt = new WebTransport(url, { congestionControl: 'throughput' });
    await this.wt.ready;
    this.controlStream = await this.wt.createBidirectionalStream();
    this.controlWriter = this.controlStream.writable;
    this.controlReader = this.controlStream.readable;
    this.datagramWriter = this.wt.datagrams.writable;
    this.datagramReader = this.wt.datagrams.readable.getReader();
    this.state = this.state | COMMUNICATOR_STATE.RUNNING;
    Mogger.debug('Connection established');
  }
  async sendControlMessage(data: Uint8Array) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      Mogger.error('Cannot send control messages as the session is already closed');
      return;
    }
    const writer = this.controlWriter.getWriter();
    await writer.write(data);
    writer.releaseLock();
    Mogger.debug('Control message sent');
  }
  async closeSubgroupStreams(subgroupIds: number[]) {
    subgroupIds.map(id => {
      this.closeSubgroupStream({ subgroupId: id });
    });
  }
  async createSubgroupStream({ subgroupId, subgroupHeader }: { subgroupId: number, subgroupHeader: Uint8Array }) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      Mogger.error('Cannot create subgroup streams as the session is already closed');
      return;
    }
    this.streams.set(subgroupId, await this.wt.createUnidirectionalStream());
    const writer = this.streams.get(subgroupId).getWriter();
    await writer.write(subgroupHeader);
    writer.releaseLock();
    Mogger.debug('Stream created');
  }
  closeSubgroupStream({ subgroupId }: { subgroupId: number }) {
    const stream = this.streams.get(subgroupId);
    if (stream) stream.close();
    this.streams.delete(subgroupId);
    Mogger.debug(`Stream with subgroupId: ${subgroupId} closed`);
  }
  async sendObject({ subgroupObject, subgroupId }: { subgroupObject: Uint8Array, subgroupId: number }) {
    // if (!this.streams.has(subgroupId)) {
    //   postMessage({ type: 'error', data: `Stream ${subgroupId} not found` });
    //   return;
    // }
    while (!this.streams.has(subgroupId)) {
      await new Promise((resolve) => setTimeout(resolve, 0.1));
    };
    try {
      const writer = this.streams.get(subgroupId).getWriter();
      await writer.write(subgroupObject);
      writer.releaseLock();
    } catch (err) {
      Mogger.error(`Error sending object: ${err}. Closing session...`);
      this.closeSession();
    }
  }
  async sendDatagram(data: Uint8Array) {
    if (this.state === COMMUNICATOR_STATE.STOPPED) {
      Mogger.error('Cannot send datagrams as the session is already closed');
      this.datagramWriter.close();
      return;
    }
    const writer = this.datagramWriter.getWriter();
    writer.write(data);
    writer.releaseLock();
  }
  closeSession() {
    this.state = COMMUNICATOR_STATE.STOPPED;
    this.controlStream.writable.getWriter().close();
    this.wt.close();
    Mogger.debug('Session closed');
  }
  async readSubgroupObject(reader: ReadableStream, trackAlias: number, subgroupId: number) {
    try {
      let done = false;
      while (!done) {
        const header = await deserializeSubgroupObjectHeader(reader);
        done = header.objectStatus && (header.objectStatus === OBJECT_STATUS.END_OF_GROUP || header.objectStatus === OBJECT_STATUS.END_OF_TRACK || header.objectStatus === OBJECT_STATUS.END_OF_TRACK_AND_GROUP);
        if (!done) {
          const encodedChunkInit = await deserializeEncodedChunk(reader);
          postMessage({ type: 'subgroupObject', data: { header, encodedChunkInit, trackAlias, subgroupId } });
        } else {
          postMessage({ type: 'subgroupObjectStatus', data: { header, subgroupId } });
        }
      }
      await reader.cancel();
    } catch (err) {
      Mogger.error(`Error reading subgroup object: ${err}`);
    }
  }
  async readDatagramObject(reader: ReadableStream) {
    // TODO: send objectStatus from publisher
    // then the end of loop can be detected
    const type = await deserializeDatagramType(reader);
    const header = await deserializeDatagramHeader(reader);
    // done = type === DATAGRAM.OBJECT_DATAGRAM_STATUS;
    if (type === DATAGRAM.OBJECT_DATAGRAM) {
      const encodedChunkInit = await deserializeEncodedChunk(reader);
      postMessage({ type: 'datagramObject', data: { header, encodedChunkInit } });
    } else {
      postMessage({ type: 'datagramObjectStatus', data: { header } });
    }
  }
  async startReadLoop() {
    while (this.state & COMMUNICATOR_STATE.RUNNING) {
      const msgType = await readControlMessageType(this.controlReader);
      let message;
      let error = '';
      // TODO: make it look cool
      switch (msgType) {
      case CONTROL_MESSAGE.SERVER_SETUP:
        message = await deserializeServerSetup(this.controlReader);
        break;
      case CONTROL_MESSAGE.ANNOUNCE_OK:
        message = await deserializeAnnounceOk(this.controlReader);
        break;
      case CONTROL_MESSAGE.ANNOUNCE_ERROR:
        message = await deserializeAnnounceError(this.controlReader);
        break;
      case CONTROL_MESSAGE.SUBSCRIBE:
        message = await deserializeSubscribe(this.controlReader);
        break;
      case CONTROL_MESSAGE.SUBSCRIBE_OK:
        message = await deserializeSubscribeOk(this.controlReader);
        break;
      case CONTROL_MESSAGE.SUBSCRIBE_ERROR:
        message = await deserializeSubscribeError(this.controlReader);
        break;
      case CONTROL_MESSAGE.SUBSCRIBE_DONE:
        message = await deserializeSubscribeDone(this.controlReader);
        break;
      case CONTROL_MESSAGE.UNSUBSCRIBE:
        message = await deserializeUnsubscribe(this.controlReader);
        break;
      default:
        error = `Unexpected message type: ${msgType}`;
      };
      !error ? postMessage({ type: `ctrl-${msgType}`, data: message }): postMessage({ type: 'error', data: error });
    }
  }
  async startStreamReadLoop() {
    if (this.state & COMMUNICATOR_STATE.READING_STREAM) {
      Mogger.debug('duplicated startStreamReadLoop call. aborting');
      return;
    }
    this.state = this.state | COMMUNICATOR_STATE.READING_STREAM;
    while (this.state & COMMUNICATOR_STATE.READING_STREAM) {
      const reader = this.wt.incomingUnidirectionalStreams.getReader();
      const { value: readableStream, done } = await reader.read();
      if (done || !readableStream) {
        Mogger.error('Stream reader closed');
        break;
      }
      const streamType = await readControlMessageType(readableStream);
      switch (streamType) {
      case STREAM.SUBGROUP_HEADER:
        const subgroupHeader = await deserializeSubgroupHeader(readableStream);
        postMessage({ type: `stream-${streamType}`, data: subgroupHeader });
        this.readSubgroupObject(readableStream, subgroupHeader.trackAlias, subgroupHeader.subgroupId);
        break;
      }
      reader.releaseLock();
    }
  }
  async startDatagramReadLoop() {
    if (this.state & COMMUNICATOR_STATE.READING_DATAGRAM) {
      Mogger.debug('duplicated startDatagramReadLoop call. aborting');
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
