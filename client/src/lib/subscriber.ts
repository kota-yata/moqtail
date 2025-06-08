import { Mogger } from './utils/mogger';
import { CONTROL_MESSAGE, deserializeVideoDecoderConfig, LOC_EXTENSION_HEADER_TYPE, MOQT_DRAFT08_VERSION, MOQT_DRAFT09_VERSION, MOQT_DRAFT10_VERSION, serializeClientSetup, serializeSubscribe, STREAM, deserializeAudioDecoderConfig, serializeUnsubscribe, OBJECT_STATUS } from 'moqtail';
import type { Subscribe, ServerSetup, SubscribeOk, SubgroupHeader, SubgroupObject, SubscribeError, Datagram } from 'moqtail';
import { moqVideoTransmissionLatencyStore, ringStats } from './utils/store';

// @ts-ignore
import CommunicatorWorker from './threads/communicator.worker?worker';
// @ts-ignore
import VideoDecoderWorker from './threads/video/decoder.worker?worker';
// @ts-ignore
import AudioDecoderWorker from './threads/audio/decoder.worker?worker';
// @ts-ignore
import VideoRendererWorker from './threads/video/renderer.worker?worker';
// @ts-ignore
import AudioWorkletURL from './threads/audio/processor.worker?worker&url';

export class Subscriber {
  private supportedVersions = [MOQT_DRAFT08_VERSION, MOQT_DRAFT09_VERSION, MOQT_DRAFT10_VERSION];
  private selectedVersion = 0;
  private subscription: RegisteredSubscription[] = [];
  private videoWaitingForKeyFrame = true;
  private audioWaitingForKeyFrame = true;
  private audioNode: AudioWorkletNode;
  private communicator: Worker;
  private videoRenderer: Worker = new VideoRendererWorker();
  constructor(props: SubscriberInitProps) {
    this.communicator = new CommunicatorWorker();
    this.communicator.onmessage = this.communicatorMessageHandler.bind(this);
    this.communicator.postMessage({ type: 'startConnection', data: props.serverUrl });
  }
  setup() {
    this.communicator.postMessage({ type: 'startReadLoop', data: null });
    const msg = serializeClientSetup({ supportedVersions: this.supportedVersions });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  subscribe(props: Subscribe, trackType: 'video' | 'audio') {
    const msg = serializeSubscribe(props);
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
    const decoder: Worker = trackType === 'video' ? new VideoDecoderWorker() : new AudioDecoderWorker();
    decoder.onmessage = this.decoderMessageHandler.bind(this);
    decoder.postMessage({ type: 'init', data: props });
    this.subscription.push({ subscribe: props, subscribeOk: false, decoder, type: trackType });
  }
  unsubscribe(trackName: string) {
    const sub = this.subscription.find(s => s.subscribe.trackName === trackName);
    const msg = serializeUnsubscribe(sub.subscribe.subscribeId);
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  stopAudio() {
    if (this.audioNode) {
      this.audioNode.disconnect();
      this.audioNode = null;
    }
  }
  setCanvasElement(canvasElement: HTMLCanvasElement) {
    const offscreen = canvasElement.transferControlToOffscreen();
    this.videoRenderer.postMessage({ type: 'init', data: { canvas: offscreen } }, [offscreen]);
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
      this.communicator.postMessage({ type: 'closeSession', data: null });
      throw new Error(err);
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
      Mogger.info(`Subscribe successful for ${msg.subscribeId}`);
      const subscription = this.subscription.find(sub => sub.subscribe.subscribeId === msg.subscribeId);
      if (!subscription) {
        Mogger.error(`Unknown subscribeOk with subscribeId:${msg.subscribeId} received`);
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
    case `stream-${STREAM.SUBGROUP_HEADER}`:
      const subgroupHeader: SubgroupHeader = message.data.data;
      sub = this.getSubscriptionByTrackAlias(subgroupHeader.trackAlias);
      Mogger.info(`Subgroup stream with trackAlias:${subgroupHeader.trackAlias} received`);
      break;
    case 'subgroupObject':
      const encodedChunkInit = message.data.data.encodedChunkInit as EncodedVideoChunkInit;
      if (this.videoWaitingForKeyFrame && encodedChunkInit.type !== 'key') {
        Mogger.debug('Waiting for video key frame...');
        break;
      }
      this.videoWaitingForKeyFrame = false;
      const videoTrackAlias: number = message.data.data.trackAlias;
      sub = this.subscription.find(s => s.subscribe.trackAlias === videoTrackAlias);
      const header = message.data.data.header as SubgroupObject;
      let videoDecoderConfig = null;
      header.extensionHeaders.map(h => {
        if (h.id === LOC_EXTENSION_HEADER_TYPE.VIDEO_CONFIG) {
          videoDecoderConfig = deserializeVideoDecoderConfig(h.value as Uint8Array);
        } else if (h.id === LOC_EXTENSION_HEADER_TYPE.CAPTURE_TIMESTAMP) {
          const sender = h.value as number;
          const now = Math.round(performance.timeOrigin) + (performance.now() | 0);
          moqVideoTransmissionLatencyStore.set(now - sender);
        }
      });
      const chunk = new EncodedVideoChunk(encodedChunkInit);
      sub.decoder.postMessage({ type: 'decode', data: { encodedVideoChunk: chunk, config: videoDecoderConfig } });
      break;
    case 'subgroupObjectStatus':
      this.communicator.postMessage({ type: 'closeStream', data: { subgroupId: message.data.data.subgroupId } });
      break;
    case 'datagramObject':
      const datagramObject = message.data.data as { header: Datagram, encodedChunkInit: EncodedAudioChunkInit | EncodedVideoChunkInit };
      
      sub = this.getSubscriptionByTrackAlias(datagramObject.header.trackAlias);
      
      if (sub.type === 'video') {
        Mogger.debug(`Datagram video object with groupId ${datagramObject.header.groupId} and objectId ${datagramObject.header.objectId} received`);
        if (this.videoWaitingForKeyFrame && datagramObject.encodedChunkInit.type !== 'key') {
          Mogger.debug('Waiting for video key frame...');
          break;
        }
        this.videoWaitingForKeyFrame = false;
        
        let videoDecoderConfig = null;
        datagramObject.header.extensionHeaders.map(h => {
          if (h.id === LOC_EXTENSION_HEADER_TYPE.VIDEO_CONFIG) {
            videoDecoderConfig = deserializeVideoDecoderConfig(h.value as Uint8Array);
          }
        });
        
        const videoChunk = new EncodedVideoChunk(datagramObject.encodedChunkInit as EncodedVideoChunkInit);
        sub.decoder.postMessage({ type: 'decode', data: { encodedVideoChunk: videoChunk, config: videoDecoderConfig } });
      } else {
        if (this.audioWaitingForKeyFrame && datagramObject.encodedChunkInit.type !== 'key') {
          Mogger.debug('Waiting for audio key frame...');
          break;
        }
        this.audioWaitingForKeyFrame = false;
        
        let audioDecoderConfig = null;
        datagramObject.header.extensionHeaders.map(h => {
          if (h.id !== LOC_EXTENSION_HEADER_TYPE.AUDIO_CONFIG) return;
          const readableStream = this.generateReadableStreamFromBuffer(h.value as Uint8Array);
          deserializeAudioDecoderConfig(readableStream).then((config) => {
            audioDecoderConfig = config;
          });
        });
        
        const audioChunk = new EncodedAudioChunk(datagramObject.encodedChunkInit as EncodedAudioChunkInit);
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
      const vfData = message.data.data as { subscribeId: number, frame: VideoFrame };
      this.videoRenderer.postMessage({ type: 'frame', data: vfData.frame }, [vfData.frame]);
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
      const stats = message.data.stats as { capacity: number, readPos: number, writePos: number };
      ringStats.set(stats);
      break;
    case 'error':
      Mogger.error(`Audio processor error: ${message.data.data}`);
      break;
    }
  }
}
