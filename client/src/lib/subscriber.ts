import { Mogger } from './utils/mogger';
import { CONTROL_MESSAGE, deserializeVideoDecoderConfig, LOC_EXTENSION_HEADER_TYPE, MOQT_DRAFT11_VERSION, serializeClientSetup, serializeSubscribe, STREAM, deserializeAudioDecoderConfig, serializeUnsubscribe, OBJECT_STATUS } from 'moqtail';
import type { Subscribe, ServerSetup, SubscribeOk, SubgroupHeader, SubgroupObject, SubscribeError, Datagram } from 'moqtail';
import { moqVideoTransmissionLatencyStore } from './store';

// @ts-ignore
import CommunicatorWorker from './threads/communicator.worker?worker';
// @ts-ignore
import VideoDecoderWorker from './threads/video/decoder.worker?worker';
// @ts-ignore
import AudioDecoderWorker from './threads/audio/decoder.worker?worker';
// @ts-ignore
import VideoRendererWorker from './threads/video/renderer.worker?worker';

type RegisteredSubscription = { subscribe: Subscribe, subscribeOk: boolean, decoder: Worker };

export class Subscriber {
  private supportedVersions = [MOQT_DRAFT11_VERSION];
  private selectedVersion = 0;
  private subscription: RegisteredSubscription[] = [];
  private videoWaitingForKeyFrame = true;
  private audioWaitingForKeyFrame = true;
  private audioCtx: AudioContext;
  private audioNextPlaybackTime = 0;
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
    this.subscription.push({ subscribe: props, subscribeOk: false, decoder });
  }
  unsubscribe(trackName: string) {
    const sub = this.subscription.find(s => s.subscribe.trackName === trackName);
    const msg = serializeUnsubscribe(sub.subscribe.subscribeId);
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  setCanvasElement(canvasElement: HTMLCanvasElement) {
    const offscreen = canvasElement.transferControlToOffscreen();
    this.videoRenderer.postMessage({ type: 'init', data: { canvas: offscreen } }, [offscreen]);
  }
  setAudioContext(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }
  private getSubscriptionByTrackAlias(trackAlias: number): RegisteredSubscription {
    const sub = this.subscription.find(s => s.subscribe.trackAlias === trackAlias);
    if (!sub) {
      const err = `Unknown subgroup object with alias:${trackAlias} received`;
      // Mogger.error(err);
      this.communicator.postMessage({ type: 'closeSession', data: null });
      throw new Error(err);
    } else if (!sub.subscribeOk) {
      const err = `Subgroup Objcet with alias:${trackAlias} received before subscribeOk`;
      // Mogger.error(err);
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
  private audioDataToAudioBuffer(audioData: AudioData) {
    const audioBuffer = this.audioCtx.createBuffer(
      audioData.numberOfChannels,
      audioData.numberOfFrames,
      audioData.sampleRate,
    );
    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
      const channelData = new Float32Array(audioData.numberOfFrames);
      audioData.copyTo(channelData, { planeIndex: channel });
      audioBuffer.copyToChannel(channelData, channel, 0);
    }
    return audioBuffer;
  }
  private playDecodedAudio(audioBuffer: AudioBuffer) {
    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);
    if (this.audioNextPlaybackTime === 0) this.audioNextPlaybackTime = this.audioCtx.currentTime;
    source.start(this.audioNextPlaybackTime, 0, audioBuffer.duration);
    this.audioNextPlaybackTime += audioBuffer.duration;
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
      const datagramObject = message.data.data as { header: Datagram, encodedChunkInit: EncodedAudioChunkInit };
      if (this.audioWaitingForKeyFrame && datagramObject.encodedChunkInit.type !== 'key') {
        Mogger.debug('Waiting for audio key frame...');
        break;
      }
      this.audioWaitingForKeyFrame = false;
      sub = this.getSubscriptionByTrackAlias(datagramObject.header.trackAlias);
      let audioDecoderConfig = null;
      datagramObject.header.extensionHeaders.map(h => {
        if (h.id !== LOC_EXTENSION_HEADER_TYPE.AUDIO_CONFIG) return;
        const readableStream = this.generateReadableStreamFromBuffer(h.value as Uint8Array);
        deserializeAudioDecoderConfig(readableStream).then((config) => {
          audioDecoderConfig = config;
        });
      });
      const audioChunk = new EncodedAudioChunk(datagramObject.encodedChunkInit);
      sub.decoder.postMessage({ type: 'decode', data: { encodedAudioChunk: audioChunk, config: audioDecoderConfig } });
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
      const audioBuffer = this.audioDataToAudioBuffer(ad);
      this.playDecodedAudio(audioBuffer);
      ad.close();
      break;
    }
  }
}
