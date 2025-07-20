import { Mogger } from './utils/mogger';
import { WarpCatalogManager } from './warpCatalogManager';
import { CONTROL_MESSAGE, deserializeVideoDecoderConfig, LOC_EXTENSION_HEADER_TYPE, MOQT_DRAFT11_VERSION, serializeClientSetup, serializeSubscribe, STREAM, deserializeAudioDecoderConfig, serializeUnsubscribe, OBJECT_STATUS, deserializeDatagramFragmentInfo, deserializeEncodedChunkFromArray, WARP_CATALOG_TRACK_NAME, PARAMETER } from 'moqtail';
import type { Subscribe, ServerSetup, SubscribeOk, SubgroupHeader, SubgroupObject, SubscribeError, Datagram } from 'moqtail';
import { moqVideoTransmissionLatencyStore, ringStats, bitrateStore } from './utils/store';

import { DatagramBuffer, BufferedDatagram } from './utils/datagramBuffer';
import { concatUint8Arrays } from 'bytes';

// @ts-ignore
import CommunicatorWorker from './threads/communicator.worker?worker';
// @ts-ignore
import VideoDecoderWorker from './threads/video/decoder.worker?worker';
// @ts-ignore
import AudioDecoderWorker from './threads/audio/decoder.worker?worker';
// @ts-ignore
// @ts-ignore
import AudioWorkletURL from './threads/audio/processor.worker?worker&url';

export class Subscriber {
  private supportedVersions = [MOQT_DRAFT11_VERSION];
  private selectedVersion = 0;
  private subscription: RegisteredSubscription[] = [];
  private videoWaitingForKeyFrame = true;
  private audioWaitingForKeyFrame = true;
  private currentVideoGroupId: number | null = null;
  private subgroupToGroup: Map<number, number> = new Map();
  private datagramBuffer = new DatagramBuffer();
  private datagramFragments: Map<string, { total: number; payloads: Uint8Array[]; header: Datagram }> = new Map();
  private videoTimestampOffset: number | null = null;
  private receivedBytes = 0; // for bitrate calculation
  private maxRequestId = 1000;
  private bitrateInterval: NodeJS.Timeout;
  private audioNode: AudioWorkletNode;
  private communicator: Worker;
  private videoGenerator?: MediaStreamTrackGenerator<VideoFrame>;
  private videoWriter?: WritableStreamDefaultWriter<VideoFrame>;
  public warpCatalogManager: WarpCatalogManager = new WarpCatalogManager();
  constructor(props: SubscriberInitProps) {
    this.communicator = new CommunicatorWorker();
    this.communicator.onmessage = this.communicatorMessageHandler.bind(this);
    this.communicator.postMessage({ type: 'startConnection', data: props.serverUrl });
    this.bitrateInterval = setInterval(() => {
      bitrateStore.set(this.receivedBytes * 8);
      this.receivedBytes = 0;
    }, 1000);
  }
  setup() {
    this.communicator.postMessage({ type: 'startReadLoop', data: null });
    const msg = serializeClientSetup({
      supportedVersions: this.supportedVersions,
      params: [
        { type: PARAMETER.SETUP.MAX_REQUEST_ID.KEY, value: this.maxRequestId }
      ]
    });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  subscribe(props: Subscribe, trackType: TrackType) {
    const msg = serializeSubscribe(props);
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
    const decoder: Worker = trackType === 'video' ? new VideoDecoderWorker() : new AudioDecoderWorker();
    decoder.onmessage = this.decoderMessageHandler.bind(this);
    decoder.postMessage({ type: 'init', data: props });
    this.subscription.push({ subscribe: props, subscribeOk: false, decoder, type: trackType });
  }
  unsubscribe(trackName: string) {
    const sub = this.subscription.find(s => s.subscribe.trackName === trackName);
    const msg = serializeUnsubscribe(sub.subscribe.requestId);
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  private handleCatalogUpdate(payload: Uint8Array) {
    // Handle WARP catalog updates
    const catalog = this.warpCatalogManager.updateCatalogFromData(payload);
    if (catalog) {
      Mogger.info(`WARP catalog updated with ${catalog.tracks.length} tracks`);
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
      Mogger.error(`Failed to load audio worklet module: ${e}`);
      this.communicator.postMessage({ type: 'closeSession', data: null });
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
      this.communicator.postMessage({ type: 'closeSession', data: null });
      throw new Error(err);
    } else if (!sub.subscribeOk) {
      const err = `Subgroup Objcet with alias:${trackAlias} received before subscribeOk`;
      // Receiving objects before subscribeOk is not an explicit protocol violation,
      // so we log it instead of throwing an error
      Mogger.error(err);
    }
    return sub;
  }
  private generateReadableStreamFromBuffer(value: Uint8Array): ReadableStream {
    return new ReadableStream({
      type: 'bytes',
      start(controller) {
        // Push the Uint8Array into the stream
        controller.enqueue(value);
        controller.close(); // Close the stream when done
      }
    });
  }
  communicatorMessageHandler(message: MessageEvent) {
    let msg;
    let sub: RegisteredSubscription;
    switch (message.data.type) {
    case `ctrl-${CONTROL_MESSAGE.SERVER_SETUP}`:
      msg = message.data.data as ServerSetup;
      if (!this.supportedVersions.includes(msg.selectedVersion)) {
        Mogger.error('Server does not support any of the versions we support');
        this.communicator.postMessage({ type: 'closeSession', data: null });
        break;
      }
      this.selectedVersion = msg.selectedVersion;
      Mogger.info(`Setup successful with version ${msg.selectedVersion}`);
      break;
    case `ctrl-${CONTROL_MESSAGE.SUBSCRIBE_OK}`:
      msg = message.data.data as SubscribeOk;
      Mogger.info(`Subscribe successful for ${msg.requestId}`);
      const subscription = this.subscription.find(sub => sub.subscribe.requestId === msg.requestId);
      if (!subscription) {
        Mogger.error(`Unknown subscribeOk with requestId:${msg.requestId} received`);
        this.communicator.postMessage({ type: 'closeSession', data: null });
        break;
      }
      subscription.subscribeOk = true;
      this.communicator.postMessage({ type: 'startStreamReadLoop', data: null });
      this.communicator.postMessage({ type: 'startDatagramReadLoop', data: null });
      break;
    case `ctrl-${CONTROL_MESSAGE.SUBSCRIBE_ERROR}`:
      msg = message.data.data as SubscribeError;
      Mogger.error(`Subscribe error for alias ${msg.trackAlias}: ${msg.reasonPhrase}`);
      const subscriptionError = this.subscription.find(sub => sub.subscribe.trackAlias === msg.trackAlias);
      if (!subscriptionError) {
        Mogger.error(`Unknown subscribeError with trackAlias:${msg.trackAlias} received`);
        this.communicator.postMessage({ type: 'closeSession', data: null });
        break;
      }
      this.subscription = this.subscription.filter(sub => sub.subscribe.trackAlias !== msg.trackAlias);
      subscriptionError.decoder.terminate();
      this.communicator.postMessage({ type: 'closeStream', data: { trackAlias: msg.trackAlias } });
      break;
    case `subgroup-header`:
      const subgroupHeader: SubgroupHeader = message.data.data;
      sub = this.getSubscriptionByTrackAlias(subgroupHeader.trackAlias);
      Mogger.info(`Subgroup stream with trackAlias:${subgroupHeader.trackAlias} received`);
      if (sub.type === 'video') {
        this.subgroupToGroup.set(subgroupHeader.subgroupId, subgroupHeader.groupId);
        if (this.currentVideoGroupId === null || this.currentVideoGroupId !== subgroupHeader.groupId) {
          this.videoWaitingForKeyFrame = true;
        }
      }
      break;
    case 'subgroupObject':
      const encodedChunkInit = message.data.data.encodedChunkInit as EncodedVideoChunkInit;
      const subgroupId = message.data.data.subgroupId as number;
      const groupId = this.subgroupToGroup.get(subgroupId);
      if (this.videoWaitingForKeyFrame && encodedChunkInit.type !== 'key') {
        Mogger.debug('Waiting for video key frame...');
        break;
      }
      this.videoWaitingForKeyFrame = false;
      this.currentVideoGroupId = groupId ?? null;
      if (this.videoTimestampOffset === null) {
        this.videoTimestampOffset = performance.now() - (encodedChunkInit.timestamp ?? 0) / 1000;
        this.datagramBuffer.setTimestampOffset(this.videoTimestampOffset);
      }
      const videoTrackAlias: number = message.data.data.trackAlias;
      sub = this.subscription.find(s => s.subscribe.trackAlias === videoTrackAlias);
      const header = message.data.data.header as SubgroupObject;
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
      sub.decoder.postMessage({ type: 'decode', data: { encodedVideoChunk: chunk, config: videoDecoderConfig } });

      if (groupId !== undefined) {
        this.datagramBuffer.releaseGroup(groupId);
        const ready = this.datagramBuffer.dequeueReady(performance.now());
        this.decodeDatagramQueue(ready, sub);
      }
      break;
    case 'subgroupObjectStatus':
      // This indicates the end of the unistream
      break;
    case 'datagramObject':
      const datagramObject = message.data.data as { header: Datagram, payload: Uint8Array, encodedChunkInit: EncodedVideoChunkInit | EncodedAudioChunkInit };

      sub = this.getSubscriptionByTrackAlias(datagramObject.header.trackAlias);

      // Check if this is a catalog track
      if (sub.subscribe.trackName === WARP_CATALOG_TRACK_NAME) {
        // Handle WARP catalog update
        this.handleCatalogUpdate(datagramObject.payload);
        break;
      }

      const fragIndex = datagramObject.header.extensionHeaders.findIndex(h => h.type === LOC_EXTENSION_HEADER_TYPE.DATAGRAM_FRAGMENT_INFO);
      if (fragIndex !== -1) {
        const info = deserializeDatagramFragmentInfo(datagramObject.header.extensionHeaders[fragIndex].value as Uint8Array);
        datagramObject.header.extensionHeaders.splice(fragIndex, 1);
        const key = `${datagramObject.header.trackAlias}-${datagramObject.header.groupId}-${datagramObject.header.objectId}`;
        let entry = this.datagramFragments.get(key);
        if (!entry) {
          entry = { total: info.totalFragments, payloads: new Array(info.totalFragments), header: datagramObject.header };
          this.datagramFragments.set(key, entry);
        }
        entry.payloads[info.fragmentIndex] = datagramObject.payload;
        if (entry.payloads.filter(p => p).length === entry.total) {
          const payload = concatUint8Arrays(entry.payloads as Uint8Array[]);
          const encodedChunkInit = deserializeEncodedChunkFromArray(payload);
          Mogger.debug(`Datagram object id ${datagramObject.header.objectId} received with all fragments`);
          const combined: BufferedDatagram = { header: entry.header, encodedChunkInit };
          this.datagramFragments.delete(key);
          datagramObject.header = combined.header;
          datagramObject.encodedChunkInit = encodedChunkInit;
        } else {
          break;
        }
      } else {
        datagramObject.encodedChunkInit = deserializeEncodedChunkFromArray(datagramObject.payload);
      }

      if (sub.type === 'video') {
        const buffered: BufferedDatagram = { header: datagramObject.header, encodedChunkInit: datagramObject.encodedChunkInit };
        this.datagramBuffer.enqueue(buffered);

        if (!this.videoWaitingForKeyFrame) {
          this.datagramBuffer.releaseGroup(datagramObject.header.groupId);
          const ready = this.datagramBuffer.dequeueReady(performance.now());
          this.decodeDatagramQueue(ready, sub);
        }
      } else if (sub.type === 'audio') {
        if (this.audioWaitingForKeyFrame && datagramObject.encodedChunkInit.type !== 'key') {
          Mogger.debug('Waiting for audio key frame...');
          break;
        }
        this.audioWaitingForKeyFrame = false;

        let audioDecoderConfig = null;
        datagramObject.header.extensionHeaders.map(h => {
          if (h.type !== LOC_EXTENSION_HEADER_TYPE.AUDIO_CONFIG) return;
          const readableStream = this.generateReadableStreamFromBuffer(h.value as Uint8Array);
          deserializeAudioDecoderConfig(readableStream).then((config) => {
            audioDecoderConfig = config;
          });
        });

        const audioChunk = new EncodedAudioChunk(datagramObject.encodedChunkInit as EncodedAudioChunkInit);
        this.receivedBytes += (datagramObject.encodedChunkInit as EncodedAudioChunkInit).data.byteLength;
        sub.decoder.postMessage({ type: 'decode', data: { encodedAudioChunk: audioChunk, config: audioDecoderConfig } });
      }
      break;
    case 'error':
      Mogger.error(`Subscriber communicator: ${message.data.data}`);
      break;
    }
  }
  decoderMessageHandler(message: MessageEvent) {
    switch (message.data.type) {
    case 'videoFrame':
      const vfData = message.data.data as { requestId: number, frame: VideoFrame };
      if (this.videoWriter) {
        this.videoWriter.write(vfData.frame).then(() => vfData.frame.close());
      }
      break;
    case 'audioData':
      const ad = message.data.data.audioData as AudioData;
      const audioBuffer = new Float32Array(ad.numberOfFrames * ad.numberOfChannels);
      // assume monoral
      ad.copyTo(audioBuffer, { planeIndex: 0 });
      this.audioNode.port.postMessage({
        type: 'audioData',
        buffer: audioBuffer.buffer,
      }, [audioBuffer.buffer]);
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
      Mogger.error(`Audio processor error: ${message.data.data}`);
      break;
    }
  }
  private decodeDatagramQueue(queue: BufferedDatagram[], sub: RegisteredSubscription) {
    for (const d of queue) {
      let vConfig: VideoDecoderConfig | null = null;
      d.header.extensionHeaders.map(h => {
        if (h.type === LOC_EXTENSION_HEADER_TYPE.VIDEO_CONFIG) {
          vConfig = deserializeVideoDecoderConfig(h.value as Uint8Array);
        }
      });
      const vChunk = new EncodedVideoChunk(d.encodedChunkInit as EncodedVideoChunkInit);
      this.receivedBytes += (d.encodedChunkInit as EncodedVideoChunkInit).data.byteLength;
      sub.decoder.postMessage({ type: 'decode', data: { encodedVideoChunk: vChunk, config: vConfig } });
    }
  }
}
