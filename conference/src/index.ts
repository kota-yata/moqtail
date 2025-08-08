import {
  CONTROL_MESSAGE,
  MOQT_DRAFT11_VERSION,
  PARAMETER,
  type Subscribe,
  deserializeAnnounceError,
  deserializeAnnounceOk,
  deserializeServerSetup,
  deserializeSubscribe,
  deserializeSubscribeDone,
  deserializeSubscribeError,
  deserializeSubscribeOk,
  readControlMessageType,
  serializeAnnounce,
  serializeClientSetup,
  serializeSubscribe,
  serializeUnannounce,
  serializeUnsubscribe,
  serializeEncodedChunk,
  deserializeEncodedChunkFromArray
} from 'moqtail';

/**
 * Simple conference helper that can both announce and subscribe tracks
 * using a single WebTransport connection.
 */
export class Conference {
  private wt: WebTransport | undefined;
  private controlWriter: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private controlReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  /** Callback for decoded remote video frames */
  onRemoteFrame?: (frame: VideoFrame) => void;

  constructor(private readonly serverUrl: string) {}

  /**
   * Establishes the WebTransport session and sends CLIENT_SETUP.
   */
  async connect(): Promise<void> {
    this.wt = new WebTransport(this.serverUrl, { congestionControl: 'throughput' });
    await this.wt.ready;
    const control = await this.wt.createBidirectionalStream();
    this.controlWriter = control.writable.getWriter();
    this.controlReader = control.readable.getReader();

    const setup = serializeClientSetup({
      supportedVersions: [MOQT_DRAFT11_VERSION],
      params: [{ type: PARAMETER.SETUP.MAX_REQUEST_ID.KEY, value: 1000 }]
    });
    await this.controlWriter.write(setup);
    // Start loops for control messages and incoming media streams
    this.readLoop();
    this.handleIncomingStreams();
  }

  /**
   * Announces a namespace to other participants.
   */
  async announce(requestId: number, namespace: string[]): Promise<void> {
    if (!this.controlWriter) throw new Error('not connected');
    const msg = serializeAnnounce({ requestId, trackNamespace: namespace, parameters: [] });
    await this.controlWriter.write(msg);
  }

  /**
   * Subscribes to a track.
   */
  async subscribe(props: Subscribe): Promise<void> {
    if (!this.controlWriter) throw new Error('not connected');
    const msg = serializeSubscribe(props);
    await this.controlWriter.write(msg);
  }

  /**
   * Unsubscribes from a track by request id.
   */
  async unsubscribe(requestId: number): Promise<void> {
    if (!this.controlWriter) throw new Error('not connected');
    const msg = serializeUnsubscribe(requestId);
    await this.controlWriter.write(msg);
  }

  /**
   * Withdraws a previous ANNOUNCE.
   */
  async unannounce(namespace: string[]): Promise<void> {
    if (!this.controlWriter) throw new Error('not connected');
    const msg = serializeUnannounce({ trackNamespace: namespace });
    await this.controlWriter.write(msg);
  }

  /**
   * Publishes a local video track over a new unidirectional stream.
   */
  async publish(stream: MediaStream): Promise<void> {
    if (!this.wt) throw new Error('not connected');
    const track = stream.getVideoTracks()[0];
    const processor = new MediaStreamTrackProcessor({ track });
    const reader = processor.readable.getReader();

    const wtStream = await this.wt.createUnidirectionalStream();
    const writer = wtStream.getWriter();

    const settings = track.getSettings();
    const encoder = new VideoEncoder({
      output: async (chunk) => {
        const data = serializeEncodedChunk(chunk);
        await writer.write(data);
      },
      error: e => console.error('encoder error', e)
    });
    encoder.configure({
      codec: 'vp8',
      width: settings.width || 640,
      height: settings.height || 480
    });

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      encoder.encode(value);
      value.close();
    }
    await writer.close();
  }

  /**
   * Reads control messages indefinitely and logs basic events.
   */
  private async readLoop(): Promise<void> {
    if (!this.controlReader) return;
    while (true) {
      const type = await readControlMessageType(this.controlReader);
      switch (type) {
        case CONTROL_MESSAGE.SERVER_SETUP:
          await deserializeServerSetup(this.controlReader);
          break;
        case CONTROL_MESSAGE.ANNOUNCE_OK:
          await deserializeAnnounceOk(this.controlReader);
          break;
        case CONTROL_MESSAGE.ANNOUNCE_ERROR:
          await deserializeAnnounceError(this.controlReader);
          break;
        case CONTROL_MESSAGE.SUBSCRIBE:
          // For conferencing, we simply log incoming subscribes. In a full
          // application this would trigger media forwarding logic.
          await deserializeSubscribe(this.controlReader);
          break;
        case CONTROL_MESSAGE.SUBSCRIBE_OK:
          await deserializeSubscribeOk(this.controlReader);
          break;
        case CONTROL_MESSAGE.SUBSCRIBE_ERROR:
          await deserializeSubscribeError(this.controlReader);
          break;
        case CONTROL_MESSAGE.SUBSCRIBE_DONE:
          await deserializeSubscribeDone(this.controlReader);
          break;
        default:
          // Ignore other control messages for brevity
          return;
      }
    }
  }

  /**
   * Reads any incoming unidirectional streams and decodes video chunks.
   */
  private async handleIncomingStreams(): Promise<void> {
    if (!this.wt) return;
    const reader = this.wt.incomingUnidirectionalStreams.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      this.handleIncomingStream(value);
    }
  }

  private async handleIncomingStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new VideoDecoder({
      output: frame => this.onRemoteFrame?.(frame),
      error: e => console.error('decoder error', e)
    });
    decoder.configure({ codec: 'vp8' });
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const init = deserializeEncodedChunkFromArray(value);
      const chunk = new EncodedVideoChunk(init);
      decoder.decode(chunk);
    }
  }
}

export default Conference;
