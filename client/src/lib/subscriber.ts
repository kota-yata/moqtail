import { Logger } from 'tslog';
import { WarpCatalogManager } from './warpCatalogManager';
import { deserializeVideoDecoderConfig, LOC_EXTENSION_HEADER_TYPE, MOQT_DRAFT11_VERSION, serializeClientSetup,
  serializeSubscribe, deserializeAudioDecoderConfig, serializeUnsubscribe, deserializeEncodedChunkFromArray, PARAMETER,
  createTransport, getTransportWorkerURL, WARP_CATALOG_TRACK_NAME,
} from 'moqtail';
import type {
  MoqTransport,
  Subscribe,
  CtrlServerSetup,
  CtrlSubscribeOk,
  CtrlSubscribeError,
  CtrlSubscribeDone,
  SubgroupHeaderEvent,
  SubgroupMediaObjectEvent,
  SubgroupObjectEvent,
  DatagramObjectEvent,
  ErrorEvent,
  SubgroupObjectStatusEvent
} from 'moqtail'
import { moqVideoTransmissionLatencyStore, ringStats, bitrateStore } from './utils/store';

import TypedVideoDecoderWorker from './threads/video/decoder.worker.typed';
import TypedAudioDecoderWorker from './threads/audio/decoder.worker.typed';
// @ts-ignore - used as URL for AudioWorklet
import AudioWorkletURL from './threads/audio/processor.worker?worker&url';
import type { VideoDecoderMessageFromWorker } from '$lib/types/video-decoder-worker';
import type { AudioDecoderMessageFromWorker } from '$lib/types/audio-decoder-worker';

export class Subscriber {
  private logger = new Logger({ name: 'Subscriber' });
  private supportedVersions = [MOQT_DRAFT11_VERSION];
  private selectedVersion = 0;
  private subscription: RegisteredSubscription[] = [];
  private videoWaitingForKeyFrame = true;
  private audioWaitingForKeyFrame = true;
  private currentVideoGroupId: number | null = null;
  private subgroupToGroup: Map<number, number> = new Map();
  private videoTimestampOffset: number | null = null;
  private receivedBytes = 0; // for bitrate calculation
  private maxRequestId = 1000;
  private bitrateInterval: NodeJS.Timeout;
  private audioNode: AudioWorkletNode;
  private transport: MoqTransport;
  private unsubEvents: (() => void)[] = [];
  private videoGenerator?: MediaStreamTrackGenerator<VideoFrame>;
  private videoWriter?: WritableStreamDefaultWriter<VideoFrame>;
  public warpCatalogManager: WarpCatalogManager = new WarpCatalogManager();
  private cleanedUp: boolean = false;
  constructor(props: SubscriberInitProps) {
    const worker = new Worker(getTransportWorkerURL(), { type: 'module' });
    this.transport = createTransport(worker, { role: 'subscriber', autoStartControlRead: true, enableDatagrams: true });
    this.unsubEvents.push(
      this.transport.on('ctrl:server-setup', this.onCtrlServerSetup.bind(this)),
      this.transport.on('ctrl:subscribe-ok', this.onCtrlSubscribeOk.bind(this)),
      this.transport.on('ctrl:subscribe-error', this.onCtrlSubscribeError.bind(this)),
      this.transport.on('ctrl:subscribe-done', this.onCtrlSubscribeDone.bind(this)),
      this.transport.on('subgroup:header', this.onSubgroupHeader.bind(this)),
      this.transport.on('subgroup:media-object', this.onSubgroupMediaObject.bind(this)),
      this.transport.on('subgroup:object', this.onSubgroupObject.bind(this)),
      this.transport.on('subgroup:object-status', this.onSubgroupObjectStatus.bind(this)),
      this.transport.on('datagram:object', this.onDatagramObject.bind(this)),
      this.transport.on('error', this.onTransportError.bind(this)),
    );
    this.transport.connect(props.serverUrl);
    this.bitrateInterval = setInterval(() => {
      bitrateStore.set(this.receivedBytes * 8);
      this.receivedBytes = 0;
    }, 1000);
  }
  private cleanupOnError() {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    clearInterval(this.bitrateInterval);
    this.transport.close();
    this.stopAudio();
    // terminate all decoders
    for (const sub of this.subscription) {
      sub.decoder.terminate();
    }
    this.subscription = [];
  }
  setup() {
    const msg = serializeClientSetup({
      supportedVersions: this.supportedVersions,
      params: [
        { type: PARAMETER.SETUP.MAX_REQUEST_ID.KEY, value: this.maxRequestId }
      ]
    });
    this.transport.sendControlMessage(msg);
  }
  subscribe(props: Subscribe, trackType: TrackType) {
    const msg = serializeSubscribe(props);
    this.transport.sendControlMessage(msg);
    const decoder = trackType === 'video' ? new TypedVideoDecoderWorker() : new TypedAudioDecoderWorker();
    decoder.onmessage = this.decoderMessageHandler.bind(this);
    decoder.postMessage({ type: 'init', data: props });
    this.subscription.push({ subscribe: props, subscribeOk: false, decoder: decoder as any, type: trackType });
  }
  unsubscribe(trackName: string) {
    const sub = this.subscription.find(s => s.subscribe.trackName === trackName);
    const msg = serializeUnsubscribe(sub.subscribe.requestId);
    this.transport.sendControlMessage(msg);
  }
  private handleCatalogUpdate(payload: Uint8Array) {
    // Handle WARP catalog updates
    const catalog = this.warpCatalogManager.updateCatalogFromData(payload);
    if (catalog) {
      this.logger.info(`WARP catalog updated with ${catalog.tracks.length} tracks`);
    }
  }
  stopAudio() {
    if (this.audioNode) {
      this.audioNode.disconnect();
      this.audioNode = null;
    }
  }
  setVideoElement(videoElement: HTMLVideoElement) {
    this.videoGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    const stream = new MediaStream([this.videoGenerator]);
    videoElement.srcObject = stream;
    this.videoWriter = this.videoGenerator.writable.getWriter();
  }
  async setAudioContext() {
    const audioCtx = new AudioContext({ sampleRate: 48000 }); // TODO: use the sample rate from the server
    await audioCtx.audioWorklet.addModule(AudioWorkletURL).catch((e) => {
      this.logger.error(`Failed to load audio worklet module: ${e}`);
      this.transport.close();
    });
    this.audioNode = new AudioWorkletNode(audioCtx, 'audio-playback-processor');
    this.audioNode.port.postMessage({ type: 'init', sampleRate: audioCtx.sampleRate });
    this.audioNode.port.onmessage = this.audioProcessorMessageHandler.bind(this);
    this.audioNode.connect(audioCtx.destination);
  }
  private getSubscriptionByTrackAlias(trackAlias: number): RegisteredSubscription {
    const sub = this.subscription.find(s => s.subscribe.trackAlias === trackAlias);
    if (!sub) {
      const err = `Unknown subgroup object with alias:${trackAlias} received`;
      this.transport.close();
      throw new Error(err);
    } else if (!sub.subscribeOk) {
      const msg = `Subgroup Objcet with alias:${trackAlias} received before subscribeOk`;
      // Receiving objects before subscribeOk is not an explicit protocol violation,
      // so we log it instead of throwing an error
      this.logger.warn(msg);
    }
    return sub;
  }
  private generateReadableStreamFromBuffer(value: Uint8Array<ArrayBuffer>): ReadableStream {
    return new ReadableStream({
      type: 'bytes',
      start(controller) {
        // Push the Uint8Array into the stream
        controller.enqueue(value);
        controller.close(); // Close the stream when done
      }
    });
  }

  // ------- Individual Transport Event Handlers -------
  private onCtrlServerSetup(message: CtrlServerSetup) {
    const msg = message.data;
    if (!this.supportedVersions.includes(msg.selectedVersion)) {
      this.logger.error('Server does not support any of the versions we support');
      this.transport.close();
      return;
    }
    this.selectedVersion = msg.selectedVersion;
    this.logger.info(`Setup successful with version ${msg.selectedVersion}`);
    // Start reading streams here because objects may arrive before subscribeOk
    this.transport.startStreamReadLoop({ mode: 'encodedChunk' });
    this.transport.startDatagramReadLoop();
  }
  private onCtrlSubscribeOk(message: CtrlSubscribeOk) {
    const msg = message.data;
    this.logger.info(`Subscribe successful for ${msg.requestId}`);
    const subscription = this.subscription.find(sub => sub.subscribe.requestId === msg.requestId);
    if (!subscription) {
      this.logger.error(`Unknown subscribeOk with requestId:${msg.requestId} received`);
      return;
    }
    subscription.subscribeOk = true;
  }
  private onCtrlSubscribeError(message: CtrlSubscribeError) {
    const msg = message.data;
    this.logger.error(`Subscribe error for alias ${msg.trackAlias}: ${msg.reasonPhrase}`);
    const subscriptionError = this.subscription.find(sub => sub.subscribe.trackAlias === msg.trackAlias);
    if (!subscriptionError) {
      this.logger.error(`Unknown subscribeError with trackAlias:${msg.trackAlias} received`);
      this.transport.close();
      return;
    }
    this.subscription = this.subscription.filter(sub => sub.subscribe.trackAlias !== msg.trackAlias);
    subscriptionError.decoder.terminate();
  }
  private onCtrlSubscribeDone(message: CtrlSubscribeDone) {
    const msg = message.data;
    this.logger.info(`Subscribe done for requestId ${msg.requestId} with status ${msg.statusCode}`);
    const subscriptionDone = this.subscription.find(sub => sub.subscribe.requestId === msg.requestId);
    if (!subscriptionDone) {
      this.logger.error(`Unknown subscribeDone with requestId:${msg.requestId} received`);
      this.transport.close();
      return;
    }
    this.subscription = this.subscription.filter(sub => sub.subscribe.requestId !== msg.requestId);
    subscriptionDone.decoder.terminate();
  }
  private onSubgroupHeader(message: SubgroupHeaderEvent) {
    const subgroupHeader = message.data;
    const subHeader = this.getSubscriptionByTrackAlias(subgroupHeader.trackAlias);
    this.logger.info(`Subgroup stream with trackAlias:${subgroupHeader.trackAlias} received`);
    if (subHeader.type === 'video') {
      this.subgroupToGroup.set(subgroupHeader.subgroupId, subgroupHeader.groupId);
      if (this.currentVideoGroupId === null || this.currentVideoGroupId !== subgroupHeader.groupId) {
        this.videoWaitingForKeyFrame = true;
      }
    }
  }
  private onSubgroupMediaObject(message: SubgroupMediaObjectEvent) {
    const encodedChunkInit = message.data.encodedChunkInit;
    const subgroupId = message.data.subgroupId;
    const groupId = this.subgroupToGroup.get(subgroupId);
    if (this.videoWaitingForKeyFrame && encodedChunkInit.type !== 'key') {
      this.logger.debug('Waiting for video key frame...');
      return;
    }
    this.videoWaitingForKeyFrame = false;
    this.currentVideoGroupId = groupId ?? null;
    if (this.videoTimestampOffset === null) {
      this.videoTimestampOffset = performance.now() - (encodedChunkInit.timestamp ?? 0) / 1000;
    }
    const videoTrackAlias = message.data.trackAlias;
    const subVideo = this.subscription.find(s => s.subscribe.trackAlias === videoTrackAlias);
    const header = message.data.header;
    let videoDecoderConfig = null;
    header.extensionHeaders.map(h => {
      if (h.type === LOC_EXTENSION_HEADER_TYPE.VIDEO_CONFIG) {
        videoDecoderConfig = deserializeVideoDecoderConfig(h.value as Uint8Array);
      } else if (h.type === LOC_EXTENSION_HEADER_TYPE.CAPTURE_TIMESTAMP) {
        const sender = h.value as number;
        const now = Math.round(performance.timeOrigin) + (performance.now() | 0);
        moqVideoTransmissionLatencyStore.set(now - sender);
      }
    });
    const chunk = new EncodedVideoChunk(encodedChunkInit);
    this.receivedBytes += encodedChunkInit.data.byteLength;
    subVideo.decoder.postMessage({ type: 'decode', data: { encodedVideoChunk: chunk, config: videoDecoderConfig } });
  }
  private onSubgroupObject(_message: SubgroupObjectEvent) {
    this.logger.warn('Received subgroup:object, which is not supported in Subscriber');
  }
  private onSubgroupObjectStatus(_message: SubgroupObjectStatusEvent) {
    // This indicates the end of the unistream
  }
  private onDatagramObject(message: DatagramObjectEvent) {
    const datagramObject = message.data;
    const subDatagram = this.getSubscriptionByTrackAlias(datagramObject.header.trackAlias);
    // Check if this is a catalog track
    if (subDatagram.subscribe.trackName === WARP_CATALOG_TRACK_NAME) {
      // Handle WARP catalog update
      this.handleCatalogUpdate(datagramObject.payload);
      return;
    }
    const chunkInit = deserializeEncodedChunkFromArray(datagramObject.payload);
    if (subDatagram.type === 'audio') {
      if (this.audioWaitingForKeyFrame && chunkInit.type !== 'key') {
        this.logger.debug('Waiting for audio key frame...');
        return;
      }
      this.audioWaitingForKeyFrame = false;

      let audioDecoderConfig = null;
      datagramObject.header.extensionHeaders.map(h => {
        if (h.type !== LOC_EXTENSION_HEADER_TYPE.AUDIO_CONFIG) return;
        const readableStream = this.generateReadableStreamFromBuffer(h.value as Uint8Array<ArrayBuffer>);
        deserializeAudioDecoderConfig(readableStream).then((config) => {
          audioDecoderConfig = config;
        });
      });
      
      const audioChunk = new EncodedAudioChunk(chunkInit as EncodedAudioChunkInit);
      this.receivedBytes += (chunkInit as EncodedAudioChunkInit).data.byteLength;
      subDatagram.decoder.postMessage({ type: 'decode', data: { encodedAudioChunk: audioChunk, config: audioDecoderConfig } });
    } else {
      // only audio is supported for datagram now
      this.logger.warn(`Datagram received for unsupported track type: ${subDatagram.type}`);
    }
  }
  private onTransportError(message: ErrorEvent) {
    const err = message.data;
    this.logger.error(`Subscriber communicator error [${err.name}]: ${err.message}`);
    if (err.shouldCleanup) this.cleanupOnError();
  }
  decoderMessageHandler(message: MessageEvent<VideoDecoderMessageFromWorker | AudioDecoderMessageFromWorker>) {
    switch (message.data.type) {
    case 'videoFrame':
      const vfData = message.data.data;
      if (this.videoWriter) {
        this.videoWriter.write(vfData.frame).then(() => vfData.frame.close());
      }
      break;
    case 'audioData':
      const ad = message.data.data.audioData;
      const audioBuffer = new Float32Array(ad.numberOfFrames * ad.numberOfChannels);
      // assume monoral
      ad.copyTo(audioBuffer, { planeIndex: 0 });
      this.audioNode.port.postMessage({
        type: 'audioData',
        buffer: audioBuffer.buffer,
      }, [audioBuffer.buffer]);
      break;
    case 'error':
      const err = message.data.data;
      this.logger.error(`Decoder error [${err.name}]: ${err.message}`);
      if (err.shouldCleanup) this.cleanupOnError();
      break;
    }
  }
  audioProcessorMessageHandler(message: MessageEvent) {
    switch (message.data.type) {
    case 'stats':
      const stats = message.data.stats as RingBufferStats;
      ringStats.set(stats);
      break;
    case 'error':
      this.logger.error(`Audio processor error: ${message.data.data}`);
      break;
    }
  }
}
