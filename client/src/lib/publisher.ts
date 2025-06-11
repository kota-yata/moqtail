// main thread for publisher
// interaction with the component page: video/audio start, stop, pause, resume,
import {
  CONTROL_MESSAGE, MOQT_DRAFT10_VERSION, PARAMETER,
  serializeAnnounce, serializeClientSetup, serializeSubgroupHeader, serializeSubscribeError, serializeSubscribeOk,
  serializeUnannounce, SUBSCRIBE_ERROR_REASON, SUBSCRIBE_FILTER, serializeSubgroupObject, serializeEncodedChunk,
  videoDecoderConfigToExtensionHeader, OBJECT_STATUS, serializeDatagram, audioDecoderConfigToExtensionHeader,
  serializeSubscribeDone, SUBSCRIBE_DONE_REASON,
  datagramFragmentInfoToExtensionHeader, serializeExtensionHeader,
} from 'moqtail';
import type { ServerSetup, AnnounceOk, Subscribe, Unsubscribe, ExtensionHeader, Datagram } from 'moqtail';
// @ts-ignore
import CommunicatorWorker from './threads/communicator.worker?worker';
// @ts-ignore
import VideoEncoderWorker from './threads/video/encoder.worker?worker';
// @ts-ignore
import AudioEncoderWorker from './threads/audio/encoder.worker?worker';
import { TrackManager } from './trackManager';
import { Mogger } from './utils/mogger';

export class Publisher {
  private communicator: Worker;
  private videoEncoders: { [key: string]: Worker } = {};
  private audioEncoder: { [key: string]: Worker } = {};
  private trackManager: TrackManager = new TrackManager();
  private supportedVersions = [MOQT_DRAFT10_VERSION];
  private selectedVersion = 0;
  private maxSubscribeId = 1000;
  private datagramMaxSize = Infinity;
  constructor(props: PublisherInitProps) {
    this.communicator = new CommunicatorWorker();
    this.communicator.onmessage = this.communicatorMessageHandler.bind(this);
    this.communicator.postMessage({ type: 'startConnection', data: props.serverUrl });
  }
  registerTrack(track: Track) {
    this.trackManager.addTrack(track);
    if (track.type === 'video') {
      this.videoEncoders[track.name] = new VideoEncoderWorker();
      this.videoEncoders[track.name].onmessage = this.videoEncoderMessageHandler.bind(this);
      this.videoEncoders[track.name].postMessage({ type: 'init', data: track });
    } else if (track.type === 'audio') {
      this.audioEncoder[track.name] = new AudioEncoderWorker();
      this.audioEncoder[track.name].onmessage = this.audioEncoderMessageHandler.bind(this);
      this.audioEncoder[track.name].postMessage({ type: 'init', data: track });
    }
  }
  startStream({ track, mediaTrack }: { track: Track, mediaTrack: MediaStreamTrack }) {
    track.streamCount = 0;
    if (!this.trackManager.getTrack({ name: track.name })) {
      this.registerTrack(track);
    }
    if (track.type === 'video') {
      const processor = new MediaStreamTrackProcessor({ track: mediaTrack as MediaStreamVideoTrack });
      if (!this.videoEncoders[track.name]) {
        Mogger.error(`Video encoder for track ${track.name} not found`);
        return;
      }
      this.videoEncoders[track.name].postMessage({ type: 'capture', data: processor.readable }, [processor.readable]);
    } else if (track.type === 'audio') {
      const processor = new MediaStreamTrackProcessor({ track: mediaTrack as MediaStreamAudioTrack });
      if (!this.audioEncoder[track.name]) {
        Mogger.error(`Audio encoder for track ${track.name} not found`);
        return;
      }
      this.audioEncoder[track.name].postMessage({ type: 'capture', data: processor.readable }, [processor.readable]);
    }
  }
  stopStream(trackName: string) {
    const track = this.trackManager.getTrack({ name: trackName });
    if (!track) {
      Mogger.error(`Track ${trackName} not found`);
      return;
    }
    track.subscribers.forEach(sub => {
      // this.closeStreamsGracefully(sub.subscribeId, )
      this.subscribeDone(sub.subscribeId, track);
    });
    const encoder = track.type === 'video' ? this.videoEncoders[track.name] : this.audioEncoder[track.name];
    encoder.postMessage({ type: 'stop', data: null });
    // encoder.terminate();
  }
  setup() {
    this.communicator.postMessage({ type: 'startReadLoop', data: null });
    const msg = serializeClientSetup({
      supportedVersions: this.supportedVersions,
      params: [
        { type: PARAMETER.SETUP.MAX_SUBSCRIBE_ID.KEY, value: this.maxSubscribeId }
      ]
    });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  announce(namespace: string[]) {
    const msg = serializeAnnounce({ trackNamespace: namespace });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  unannounce(namespace: string[]) {
    const msg = serializeUnannounce({ trackNamespace: namespace });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  subscribeDone(subscribeId: number, track: Track) {
    const msg = serializeSubscribeDone({
      subscribeId: subscribeId,
      statusCode: SUBSCRIBE_DONE_REASON.TRACK_ENDED,
      reasonPhrase: 'Publisher has stopped sending the track',
      streamCount: track.objectForwardingPrefereces === 'Datagram' ? 0 : track.streamCount
    });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  private getPublisherPriority(trackType: 'video' | 'audio', subgroupId = 128) {
    if (trackType === 'audio') {
      return 0;
    } else {
      // video is less prioritized than audio (10 is just random)
      // publisher priority must be between 0-255
      return (subgroupId + 10 % 256);
    }
  }
  private sendEndOfGroup(lastSubgroupId: number, lastObjectId: number) {
    const subgroupObject = serializeSubgroupObject({
      objectId: lastObjectId,
      extensionHeaders: [],
      objectStatus: OBJECT_STATUS.END_OF_GROUP,
      payload: new Uint8Array(0)
    });
    this.communicator.postMessage({ type: 'sendSubgroupObject', data: { subgroupObject, subgroupId: lastSubgroupId } });
    // instead of closing from the publisher, the subscriber close the stream after receiving the last object
    // that way, 'short buffer' error in the subscriber can be avoided
  }
  // find all track aliases of subscribers that are interested in the latest object
  private getAliasOfSubscribersWithLatestObjectFilter(track: Track) {
    return track.subscribers.filter(sub => sub.filterType === SUBSCRIBE_FILTER.LATEST_OBJECT).map(sub => sub.trackAlias);
  }
  private createSubgroupStream(subgroupId: number, targetTrack: Track) {
    const aliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
    Mogger.debug(`Creating subgroup stream for subgroupId ${subgroupId} with aliases ${aliases}`);
    for (const alias of aliases) {
      const subgroupHeader = serializeSubgroupHeader({
        trackAlias: alias,
        subgroupId,
        groupId: targetTrack.largestGroupId,
        publisherPriority: this.getPublisherPriority(targetTrack.type, subgroupId),
      });
      this.communicator.postMessage({ type: 'createSubgroupStream', data: { subgroupId, subgroupHeader } });
    }
    targetTrack.streamCount++;
  }

  private sendDatagramWithFragmentation(datagram: Datagram) {
    const baseSize = serializeDatagram({ ...datagram, payload: new Uint8Array(0) }).byteLength;
    if (baseSize + datagram.payload.byteLength <= this.datagramMaxSize) {
      const datagramBytes = serializeDatagram(datagram);
      this.communicator.postMessage({ type: 'sendDatagram', data: datagramBytes });
      return;
    }
    const sampleHeader = datagramFragmentInfoToExtensionHeader(0, 0);
    const fragHeaderSize = serializeExtensionHeader(sampleHeader).byteLength;
    const maxPayload = this.datagramMaxSize - baseSize - fragHeaderSize;
    const totalFragments = Math.ceil(datagram.payload.byteLength / maxPayload);
    let offset = 0;
    for (let i = 0; i < totalFragments; i++) {
      const fragmentPayload = datagram.payload.slice(offset, offset + maxPayload);
      offset += maxPayload;
      const header = datagramFragmentInfoToExtensionHeader(i, totalFragments);
      const d = serializeDatagram({
        ...datagram,
        extensionHeaders: [...datagram.extensionHeaders, header],
        payload: fragmentPayload,
      });
      this.communicator.postMessage({ type: 'sendDatagram', data: d });
    }
  }

  // Common method to prepare video chunk data
  private prepareVideoChunkData(
    videoChunkMsg: any,
    targetTrack: Track
  ): { videoChunkBytes: Uint8Array; extensionHeaders: ExtensionHeader[] } {
    const videoChunkBytes = serializeEncodedChunk(videoChunkMsg.chunk);
    
    let extensionHeaders: ExtensionHeader[] = [];
    
    // if (videoChunkMsg.metadata.decoderConfig.codec === 'avc1.42001e') {
    //   extensionHeaders = getMiExtensionHeaders(MI_MEDIA_TYPE.H264AVCC, videoChunkMsg.metadata.decoderConfig, videoChunkMsg.chunk, videoChunkMsg.metadata.totalChunkCount);
    // } else if (videoChunkMsg.metadata.decoderConfig) {
    //   extensionHeaders = [videoDecoderConfigToExtensionHeader(videoChunkMsg.metadata.decoderConfig)];
    // }
    if (videoChunkMsg.metadata.decoderConfig) {
      extensionHeaders = [videoDecoderConfigToExtensionHeader(videoChunkMsg.metadata.decoderConfig)];
    }
    
    // Add capture timestamp for latency measurement (less frequent)
    // if (videoChunkMsg.chunk.timestamp % 4 === 0) { // %4 is just a random number. I want the latency measurement to be less frequent
    //   extensionHeaders.push(captureTimestampToExtensionHeader(Math.round(performance.timeOrigin) + (performance.now() | 0)));
    // }
    
    return { videoChunkBytes, extensionHeaders };
  }

  private sendVideoAsDatagram(videoChunkMsg: MoqtailVideoChunkMessage, targetTrack: Track) {
    // if (videoChunkMsg.metadata.frameType === 'key') {
    //   targetTrack.largestGroupId !== undefined ? targetTrack.largestGroupId++ : targetTrack.largestGroupId = 0;
    //   targetTrack.largestObjectId = 0;
    // } else {
    //   targetTrack.largestObjectId !== undefined ? targetTrack.largestObjectId++ : targetTrack.largestObjectId = 0;
    // }
    targetTrack.largestGroupId !== undefined ? targetTrack.largestGroupId++ : targetTrack.largestGroupId = 0;
    targetTrack.largestObjectId = 0;

    const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg, targetTrack);
    
    // Send to interested subscribers
    const interestedAliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
    for (const alias of interestedAliases) {
      const datagram: Datagram = {
        trackAlias: alias,
        groupId: targetTrack.largestGroupId,
        objectId: targetTrack.largestObjectId,
        publisherPriority: this.getPublisherPriority(targetTrack.type),
        extensionHeaders,
        payload: videoChunkBytes,
      };
      Mogger.debug(`Datagram payload size: ${videoChunkBytes.byteLength} bytes`);
      this.sendDatagramWithFragmentation(datagram);
    }
  }

  private sendVideoAsStream(videoChunkMsg: MoqtailVideoChunkMessage, targetTrack: Track) {
    const group = targetTrack.groups.find(g => g.groupId === targetTrack.largestGroupId);
    let subgroupId = (videoChunkMsg.metadata.temporalLayerId ?? 0) + (targetTrack.largestGroupId !== undefined ? targetTrack.largestGroupId : 0);
    
    if (videoChunkMsg.metadata.frameType === 'key') {
      // Create new group
      targetTrack.largestGroupId !== undefined ? targetTrack.largestGroupId++ : targetTrack.largestGroupId = 0;
      targetTrack.largestObjectId = undefined;
      // Reset subgroupId for key frame (largetGroupId is incremented above)
      subgroupId = (videoChunkMsg.metadata.temporalLayerId ?? 0) + (targetTrack.largestGroupId !== undefined ? targetTrack.largestGroupId : 0);
      targetTrack.groups.push({ groupId: targetTrack.largestGroupId, publishedSubgroupIds: [subgroupId] });
      this.createSubgroupStream(subgroupId, targetTrack);
    } else {
      // if not a key frame, find the largest group
      if (!group) {
        Mogger.error(`groupId ${targetTrack.largestGroupId} not found`);
        return;
      }
      // If this frame is the first object of the subgroup, create a unidirectional stream with SUBGROUP_HEADER
      // Non-key frames that are the first in their subgroup is only possible when SVC
      if (!group.publishedSubgroupIds.includes(subgroupId)) {
        this.createSubgroupStream(subgroupId, targetTrack);
        group.publishedSubgroupIds.push(subgroupId);
      }
    }
    targetTrack.largestObjectId !== undefined ? targetTrack.largestObjectId++ : targetTrack.largestObjectId = 0;
    const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg, targetTrack);
    
    const subgroupObject = serializeSubgroupObject({
      objectId: targetTrack.largestObjectId,
      extensionHeaders,
      payload: videoChunkBytes
    });
    this.communicator.postMessage({ type: 'sendSubgroupObject', data: { subgroupObject, subgroupId } });

    // Send END_OF_GROUP if this is the last object
    const isLast = targetTrack.largestObjectId + 1 === targetTrack.encoderConfig.keyFrameDuration;
    if (isLast) {
      this.sendEndOfGroup(subgroupId, targetTrack.largestObjectId + 1);
    }
  }

  private sendKeyFrameStream(videoChunkMsg: MoqtailVideoChunkMessage, targetTrack: Track) {
    if (videoChunkMsg.metadata.frameType === 'key') {
      // Start a new group and send key frame over stream
      const subgroupId = (videoChunkMsg.metadata.temporalLayerId ?? 0) + ((targetTrack.largestGroupId ?? -1) + 1);
      targetTrack.largestGroupId = (targetTrack.largestGroupId ?? -1) + 1;
      targetTrack.largestObjectId = undefined;
      targetTrack.groups.push({ groupId: targetTrack.largestGroupId, publishedSubgroupIds: [subgroupId] });
      this.createSubgroupStream(subgroupId, targetTrack);

      targetTrack.largestObjectId !== undefined ? targetTrack.largestObjectId++ : targetTrack.largestObjectId = 0;
      const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg, targetTrack);

      const subgroupObject = serializeSubgroupObject({
        objectId: targetTrack.largestObjectId,
        extensionHeaders,
        payload: videoChunkBytes
      });
      this.communicator.postMessage({ type: 'sendSubgroupObject', data: { subgroupObject, subgroupId } });
    } else {
      // Delta frames are sent as datagram objects within the current group
      if (targetTrack.largestGroupId === undefined) return; // drop until first key frame
      targetTrack.largestObjectId !== undefined ? targetTrack.largestObjectId++ : targetTrack.largestObjectId = 0;
      const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg, targetTrack);
      const aliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
      for (const alias of aliases) {
        const datagram: Datagram = {
          trackAlias: alias,
          groupId: targetTrack.largestGroupId,
          objectId: targetTrack.largestObjectId,
          publisherPriority: this.getPublisherPriority(targetTrack.type),
          extensionHeaders,
          payload: videoChunkBytes
        };
        this.sendDatagramWithFragmentation(datagram);
      }
    }

    // Send END_OF_GROUP if this is the last object of the group
    if (targetTrack.largestObjectId !== undefined &&
        targetTrack.encoderConfig &&
        targetTrack.largestObjectId + 1 === targetTrack.encoderConfig.keyFrameDuration) {
      this.sendEndOfGroup(targetTrack.largestGroupId, targetTrack.largestObjectId + 1);
    }
  }

  // ------- Message Handlers for workers -------
  private communicatorMessageHandler(message: MessageEvent) {
    let msg;
    switch (message.data.type) {
    case 'datagramMaxSize':
      this.datagramMaxSize = message.data.data as number;
      Mogger.info(`Datagram max size set to ${this.datagramMaxSize}`);
      break;
    case `ctrl-${CONTROL_MESSAGE.SERVER_SETUP}`:
      msg = message.data.data as ServerSetup;
      if (!this.supportedVersions.includes(msg.selectedVersion)) {
        Mogger.error('Server does not support any of the versions we support');
        this.communicator.postMessage({ type: 'closeSession', data: null });
        break;
      }
      Mogger.info(`Setup successful with version ${msg.selectedVersion}`);
      this.selectedVersion = msg.selectedVersion;
      break;
    case `ctrl-${CONTROL_MESSAGE.ANNOUNCE_OK}`:
      msg = message.data.data as AnnounceOk;
      Mogger.info(`Announce with namespace ${message.data.data.trackNamespace} successful`);
      break;
    case `ctrl-${CONTROL_MESSAGE.ANNOUNCE_ERROR}`:
      Mogger.error(`Announce error for namespace ${message.data.data.trackNamespace}. reason: ${message.data.data.reasonPhrase}`);
      break;
    case `ctrl-${CONTROL_MESSAGE.SUBSCRIBE}`:
      msg = message.data.data as Subscribe;
      const targetTrack = this.trackManager.getTrack({ name: msg.trackName });
      if (!targetTrack) {
        const sub_err = serializeSubscribeError({
          subscribeId: msg.subscribeId,
          errorCode: SUBSCRIBE_ERROR_REASON.TRACK_DOES_NOT_EXIST,
          reasonPhrase: '',
          trackAlias: msg.trackAlias
        });
        this.communicator.postMessage({ type: 'sendControlMessage', data: sub_err });
        break;
      }
      if (targetTrack.subscribers.length == 0) {
        const targetEncoder = targetTrack.type === 'video' ? this.videoEncoders[targetTrack.name] : this.audioEncoder[targetTrack.name];
        targetEncoder.postMessage({ type: 'encode', data: null });
      }
      this.trackManager.addSubscriber({
        name: msg.trackName,
        subscribeId: msg.subscribeId,
        trackAlias: msg.trackAlias,
        filterType: msg.filterType
      });
      const sub_ok = serializeSubscribeOk({ subscribeId: msg.subscribeId, expires: 0, groupOrder: msg.groupOrder || targetTrack.groupOrderPublisherPreference, contentExists: 0 });
      this.communicator.postMessage({ type: 'sendControlMessage', data: sub_ok });
      Mogger.info(`Initialized subscription for track ${msg.trackName} with subscribeId ${msg.subscribeId} and alias ${msg.trackAlias}`);
      break;
    case `ctrl-${CONTROL_MESSAGE.UNSUBSCRIBE}`:
      msg = message.data.data as Unsubscribe;
      const emptyTracks = this.trackManager.removeSubscriber(msg.subscribeId);
      Mogger.debug(`Unsubscribe with subscribeId ${msg.subscribeId} successful`);
      if (emptyTracks.length > 0) {
        emptyTracks.forEach(track => {
          const targetEncoder = track.type === 'video' ? this.videoEncoders[track.name] : this.audioEncoder[track.name];
          targetEncoder.postMessage({ type: 'stop', data: null });
          targetEncoder.terminate();
          Mogger.debug(`Stopping encoder for track ${track.name}`);
        });
      }
      break;
    case 'error':
      Mogger.error(`Publisher communicator: ${message.data.data}`);
      break;
    default:
      Mogger.error(`Unexpected message type from communicator ${message.data.type}`);
      break;
    }
  }
  private videoEncoderMessageHandler(message: MessageEvent) {
    const data = message.data as ThreadMessage;
    switch (data.type) {
    case 'videoChunk':
      const videoChunkMsg = data.data as MoqtailVideoChunkMessage;
      const targetTrack = this.trackManager.getTrack({ name: videoChunkMsg.trackName });
      if (!targetTrack) {
        Mogger.error(`Track ${videoChunkMsg.trackName} not found`);
        return;
      }

      // Decide how to forward the object
      if (targetTrack.objectForwardingPrefereces === 'Datagram') {
        this.sendVideoAsDatagram(videoChunkMsg, targetTrack);
      } else if (targetTrack.objectForwardingPrefereces === 'KeyFrameStream') {
        this.sendKeyFrameStream(videoChunkMsg, targetTrack);
      } else {
        this.sendVideoAsStream(videoChunkMsg, targetTrack);
      }
      break;
    case 'error':
      Mogger.error(`Error from video encoder: ${message.data.data}`);
      break;
    }
  }
  private audioEncoderMessageHandler(message: MessageEvent) {
    const data = message.data as ThreadMessage;
    switch (data.type) {
    // handling the latest encoded audio chunk
    case 'audioChunk':
      const audioChunkMsg = message.data.data as MoqtailAudioChunkMessage;
      const audioTrack = this.trackManager.getTrack({ name: audioChunkMsg.trackName });
      if (!audioTrack) {
        Mogger.error(`Track ${audioChunkMsg.trackName} not found`);
        return;
      }
      if (audioChunkMsg.chunk.type === 'key') {
        audioTrack.largestGroupId++;
        audioTrack.largestObjectId = 0;
      }
      const audioChunkBytes = serializeEncodedChunk(audioChunkMsg.chunk);
      const interestedAliases = this.getAliasOfSubscribersWithLatestObjectFilter(audioTrack);
      for (const alias of interestedAliases) {
        const datagram: Datagram = {
          trackAlias: alias,
          groupId: audioTrack.largestGroupId,
          objectId: audioTrack.largestObjectId,
          publisherPriority: this.getPublisherPriority(audioTrack.type),
          extensionHeaders: audioChunkMsg.metadata.decoderConfig ? [audioDecoderConfigToExtensionHeader(audioChunkMsg.metadata.decoderConfig)]: [],
          payload: audioChunkBytes,
        };
        this.sendDatagramWithFragmentation(datagram);
      }
      audioTrack.largestObjectId++;
      break;
    case 'error':
      Mogger.error(`Error from video encoder: ${message.data.data}`);
      break;
    }
  }
}
