// main thread for publisher
// interaction with the component page: video/audio start, stop, pause, resume,
import {
  CONTROL_MESSAGE, MOQT_DRAFT11_VERSION, PARAMETER,
  serializeAnnounce, serializeClientSetup, serializeSubgroupHeader, serializeSubscribeError, serializeSubscribeOk,
  serializeUnannounce, SUBSCRIBE_ERROR_REASON, SUBSCRIBE_FILTER, serializeSubgroupObject, serializeEncodedChunk,
  videoDecoderConfigToExtensionHeader, OBJECT_STATUS, serializeDatagram, audioDecoderConfigToExtensionHeader,
  serializeSubscribeDone, SUBSCRIBE_DONE_REASON,
  datagramFragmentInfoToExtensionHeader, serializeExtensionHeader,
  getMiExtensionHeaders,
  MI_MEDIA_TYPE,
  captureTimestampToExtensionHeader,
  WARP_CATALOG_TRACK_NAME,
  GROUP_ORDER,
  DATAGRAM_TYPE,
  STREAM,
  AUTH_TOKEN_ALIAS_TYPE
} from 'moqtail';
import type { ServerSetup, AnnounceOk, Subscribe, Unsubscribe, ExtensionHeader, Datagram } from 'moqtail';
import TypedCommunicatorWorker from './threads/communicator.worker.typed';
import TypedVideoEncoderWorker from './threads/video/encoder.worker.typed';
import TypedAudioEncoderWorker from './threads/audio/encoder.worker.typed';
import { TrackManager } from './trackManager';
import { WarpCatalogManager } from './warpCatalogManager';
import { Logger } from 'tslog';

import type { CommunicatorMessageFromWorker } from '$lib/types/communicator-worker';
import type { VideoEncoderMessageFromWorker } from '$lib/types/video-encoder-worker';
import type { AudioEncoderMessageFromWorker } from '$lib/types/audio-encoder-worker';

export class Publisher {
  private logger = new Logger({ name: 'Publisher' });
  private communicator: InstanceType<typeof TypedCommunicatorWorker>;
  private videoEncoders: { [key: string]: InstanceType<typeof TypedVideoEncoderWorker> } = {};
  private audioEncoders: { [key: string]: InstanceType<typeof TypedAudioEncoderWorker> } = {};
  private trackManager: TrackManager = new TrackManager();
  private warpCatalogManager: WarpCatalogManager = new WarpCatalogManager();
  private supportedVersions = [MOQT_DRAFT11_VERSION];
  private selectedVersion = 0;
  private maxRequestId = 1000;
  private currentRequestId = -2; // Will become 0 after first increment
  private datagramMaxSize = 1024;
  private namespace: string[] = [];
  private requestIdToNamespace: Map<number, string[]> = new Map();
  constructor(props: PublisherInitProps) {
    this.communicator = new TypedCommunicatorWorker();
    this.communicator.onmessage = this.communicatorMessageHandler.bind(this);
    this.communicator.postMessage({ type: 'startConnection', data: props.serverUrl });

    // Set trackManager reference in warpCatalogManager
    this.warpCatalogManager.setTrackManager(this.trackManager);
  }
  registerTrack(track: Track): InstanceType<typeof TypedVideoEncoderWorker> | InstanceType<typeof TypedAudioEncoderWorker> {
    this.trackManager.upsertTrack(track);
    if (track.type === 'video') {
      this.videoEncoders[track.name] = new TypedVideoEncoderWorker();
      this.videoEncoders[track.name].onmessage = this.videoEncoderMessageHandler.bind(this);
      this.videoEncoders[track.name].postMessage({ type: 'init', data: track });
      return this.videoEncoders[track.name];
    } else if (track.type === 'audio') {
      this.audioEncoders[track.name] = new TypedAudioEncoderWorker();
      this.audioEncoders[track.name].onmessage = this.audioEncoderMessageHandler.bind(this);
      this.audioEncoders[track.name].postMessage({ type: 'init', data: track });
      return this.audioEncoders[track.name];
    } else {
      throw new Error(`registerTrack only supports video and audio. received: ${track.type}`);
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
        this.logger.error(`Video encoder for track ${track.name} not found`);
        return;
      }
      this.videoEncoders[track.name].postMessage({ type: 'capture', data: processor.readable }, [processor.readable]);
    } else if (track.type === 'audio') {
      const processor = new MediaStreamTrackProcessor({ track: mediaTrack as MediaStreamAudioTrack });
      if (!this.audioEncoders[track.name]) {
        this.logger.error(`Audio encoder for track ${track.name} not found`);
        return;
      }
      this.audioEncoders[track.name].postMessage({ type: 'capture', data: processor.readable }, [processor.readable]);
    }
  }
  replaceMediaTrack(trackName: string, mediaTrack: MediaStreamTrack) {
    const track = this.trackManager.getTrack({ name: trackName });
    if (!track) {
      this.logger.error(`Track ${trackName} not found`);
      return;
    }
    let encoder: InstanceType<typeof TypedVideoEncoderWorker> | InstanceType<typeof TypedAudioEncoderWorker>;
    if (track.type === 'video') {
      encoder = this.videoEncoders[track.name];
      delete this.videoEncoders[track.name];
    } else if (track.type === 'audio') {
      encoder = this.audioEncoders[track.name];
      delete this.audioEncoders[track.name];
    }
    if (!encoder) {
      this.logger.error(`Encoder for track ${track.name} not found`);
      return;
    }
    encoder.postMessage({ type: 'stop', data: null });
    encoder.terminate();
    const newEncoder = this.registerTrack(track);
    this.startStream({ track, mediaTrack });
    if (track.subscribers.length > 0) {
      newEncoder.postMessage({ type: 'encode', data: null });
    }
  }
  stopStream(trackName: string) {
    const track = this.trackManager.getTrack({ name: trackName });
    if (!track) {
      this.logger.error(`Track ${trackName} not found`);
      return;
    }
    const encoder = track.type === 'video' ? this.videoEncoders[track.name] : this.audioEncoders[track.name];
    encoder.postMessage({ type: 'stop', data: null });
    encoder.terminate();
    track.subscribers.forEach(sub => {
      this.subscribeDone(sub.requestId, track);
      this.trackManager.removeSubscriber(sub.requestId);
    });
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
  private getNextRequestId(): number {
    this.currentRequestId += 2; // Client uses even Request IDs (0, 2, 4, 6, ...)
    return this.currentRequestId;
  }

  announce(namespace: string[]) {
    this.namespace = namespace;
    const requestId = this.getNextRequestId();
    this.requestIdToNamespace.set(requestId, namespace);
    const msg = serializeAnnounce({ requestId, trackNamespace: namespace, parameters: [
      {
        type: PARAMETER.AUTHORIZATION_INFO.KEY,
        value: {
          aliasType: AUTH_TOKEN_ALIAS_TYPE.USE_VALUE,
          tokenType: 0,
          tokenValue: 'ilovemoxygen'
        }
      }
    ] });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  unannounce(namespace: string[]) {
    const msg = serializeUnannounce({ trackNamespace: namespace });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  subscribeDone(requestId: number, track: Track) {
    const msg = serializeSubscribeDone({
      requestId: requestId,
      statusCode: SUBSCRIBE_DONE_REASON.TRACK_ENDED,
      reasonPhrase: 'Publisher has stopped sending the track',
      streamCount: track.objectForwardingPrefereces === 'Datagram' ? 0 : track.streamCount
    });
    this.communicator.postMessage({ type: 'sendControlMessage', data: msg });
  }
  // WARP Catalog Methods
  initializeWarpCatalog() {
    // Register catalog track to TrackManager first
    const catalogTrack: Track = {
      namespace: this.namespace,
      name: WARP_CATALOG_TRACK_NAME,
      groups: [],
      groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
      objectForwardingPrefereces: 'Datagram',
      type: 'catalog',
      subscribers: [],
      streamCount: 0
    };
    this.trackManager.upsertTrack(catalogTrack);

    // Initialize WARP catalog from trackManager (it will read media tracks automatically)
    this.warpCatalogManager.initializeCatalog(this.namespace.join('/'));
    this.publishCatalog();
  }
  // Publish the current WARP catalog
  publishCatalog(alias?: number) {
    const catalogData = this.warpCatalogManager.serializeCatalog();
    if (catalogData && alias !== undefined) {
      this.sendCatalog(alias, catalogData);
    } else if (catalogData) {
      this.broadcastCatalog(catalogData);
    }
  }
  broadcastCatalog(catalogData: Uint8Array) {
    const interestedAliases = this.getAliasOfSubscribersForCatalog();
    interestedAliases.map(alias => { this.sendCatalog(alias, catalogData); });
  }
  sendCatalog(alias: number, catalogData: Uint8Array) {
    const datagram: Datagram = {
      type: DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION,
      trackAlias: alias,
      groupId: 0,
      objectId: Date.now(),
      publisherPriority: this.getPublisherPriority('catalog'),
      extensionHeaders: [],
      payload: catalogData,
    };
    this.sendDatagram(datagram);
  }
  private getAliasOfSubscribersForCatalog(): number[] {
    // Find subscribers interested in the catalog track
    const catalogTrack = this.trackManager.getTrack({ name: WARP_CATALOG_TRACK_NAME });
    if (catalogTrack) {
      return catalogTrack.subscribers
        .filter(sub => sub.filterType === SUBSCRIBE_FILTER.LATEST_OBJECT)
        .map(sub => sub.trackAlias);
    }
    return [];
  }
  addWarpTrack(track: Track) {
    // Track is already added to trackManager via registerTrack()
    // Just ensure catalog track is registered and update catalog
    if (!this.trackManager.getTrack({ name: WARP_CATALOG_TRACK_NAME })) {
      const catalogTrack: Track = {
        namespace: this.namespace,
        name: WARP_CATALOG_TRACK_NAME,
        groups: [],
        groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
        objectForwardingPrefereces: 'Datagram',
        type: 'catalog',
        subscribers: [],
        streamCount: 0
      };
      this.trackManager.upsertTrack(catalogTrack);
    }

    // Update catalog (warpCatalogManager will read from trackManager)
    if (this.warpCatalogManager.supportsDeltaUpdates()) {
      const patchData = this.warpCatalogManager.createAddTrackPatch(track.name, this.namespace.join('/'));
      this.broadcastCatalog(patchData);
    } else {
      this.warpCatalogManager.rebuildCatalog(this.namespace.join('/'));
      this.publishCatalog();
    }
  }
  removeWarpTrack(trackName: string) {
    // Remove track from trackManager and update catalog
    const track = this.trackManager.getTrack({ name: trackName });
    if (track) {
      // Stop encoding and notify subscribers
      track.subscribers.forEach(sub => {
        this.subscribeDone(sub.requestId, track);
        this.removeSubscriber(sub.requestId);
      });
      // Remove from trackManager (warpCatalogManager will read updated state)
      this.trackManager.removeTrack(trackName);
      if (this.warpCatalogManager.supportsDeltaUpdates()) {
        const patchData = this.warpCatalogManager.createRemoveTrackPatch(trackName, this.namespace.join('/'));
        if (patchData) {
          this.broadcastCatalog(patchData);
        }
      } else {
        this.warpCatalogManager.rebuildCatalog(this.namespace.join('/'));
        this.publishCatalog();
      }
    }
  }
  terminateWarpSession() {
    const terminatingCatalog = this.warpCatalogManager.createTerminatingCatalog();
    this.broadcastCatalog(terminatingCatalog);
  }
  getWarpCatalog() {
    return this.warpCatalogManager.getCurrentCatalog();
  }
  getTimeAlignedTracks() {
    return this.warpCatalogManager.getTimeAlignedTracks();
  }
  private getPublisherPriority(trackType: TrackType, subgroupId = 128) {
    if (trackType === 'audio') {
      return 0;
    } else if (trackType === 'video') {
      // video is less prioritized than audio (10 is just random)
      // publisher priority must be between 0-255
      return (subgroupId + 10 % 256);
    } else {
      return 255; // catalog tracks are not prioritized
    }
  }
  private sendEndOfGroup(lastSubgroupId: number, lastObjectId: number) {
    const subgroupObject = serializeSubgroupObject({
      objectId: lastObjectId,
      extensionHeaders: [],
      objectStatus: OBJECT_STATUS.END_OF_GROUP,
      payload: new Uint8Array(0)
    });
    this.communicator.postMessage({ type: 'sendSubgroupObject', data: { subgroupObject, subgroupId: lastSubgroupId, isLast: true } });
  }
  private removeSubscriber(requestId: number) {
    const emptyTracks = this.trackManager.removeSubscriber(requestId);
    if (emptyTracks.length > 0) {
      emptyTracks.forEach(track => {
        const targetEncoder = track.type === 'video' ? this.videoEncoders[track.name] : this.audioEncoders[track.name];
        if (!targetEncoder) {
          // This is possible if the handler for "session closed" is already called
          this.logger.debug(`Encoder for track ${track.name} not found, skipping stop`);
          return;
        }
        targetEncoder.postMessage({ type: 'stop', data: null });
        // targetEncoder.terminate();
        this.logger.debug(`Stopping encoder for track ${track.name}`);
      });
    }
  }
  // find all track aliases of subscribers that are interested in the latest object
  private getAliasOfSubscribersWithLatestObjectFilter(track: Track) {
    return track.subscribers.filter(sub => sub.filterType === SUBSCRIBE_FILTER.LATEST_OBJECT).map(sub => sub.trackAlias);
  }
  private createSubgroupStream(subgroupId: number, targetTrack: Track) {
    const aliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
    this.logger.debug(`Creating subgroup stream for subgroupId ${subgroupId} with aliases ${aliases}`);
    for (const alias of aliases) {
      const subgroupHeader = serializeSubgroupHeader({
        type: STREAM.SUBGROUP_FIELD_WITH_EXTENSION,
        trackAlias: alias,
        subgroupId,
        groupId: targetTrack.largestGroupId,
        publisherPriority: this.getPublisherPriority(targetTrack.type, subgroupId),
      });
      this.communicator.postMessage({ type: 'createSubgroupStream', data: { subgroupId, subgroupHeader } });
    }
    targetTrack.streamCount++;
  }
  private sendDatagram(datagram: Datagram) {
    const baseSize = serializeDatagram({ ...datagram, payload: new Uint8Array(0) }).byteLength;
    if (baseSize + datagram.payload.byteLength <= this.datagramMaxSize) {
      const datagramBytes = serializeDatagram(datagram);
      this.communicator.postMessage({ type: 'sendDatagram', data: datagramBytes });
      return;
    }
    // If the datagram is too large, we need to fragment it
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
  ): { videoChunkBytes: Uint8Array; extensionHeaders: ExtensionHeader[] } {
    const videoChunkBytes = serializeEncodedChunk(videoChunkMsg.chunk);

    let extensionHeaders: ExtensionHeader[] = [];

    if (videoChunkMsg.metadata.decoderConfig?.codec === 'avc1.42001e') {
      extensionHeaders = getMiExtensionHeaders(MI_MEDIA_TYPE.H264AVCC, videoChunkMsg.metadata.decoderConfig, videoChunkMsg.chunk, videoChunkMsg.metadata.totalChunkCount);
    } else if (videoChunkMsg.metadata.decoderConfig) {
      extensionHeaders = [videoDecoderConfigToExtensionHeader(videoChunkMsg.metadata.decoderConfig)];
    }

    // Add capture timestamp for latency measurement (less frequent)
    if (videoChunkMsg.chunk.timestamp % 4 === 0) { // %4 is just a random number. I want the latency measurement to be less frequent
      extensionHeaders.push(captureTimestampToExtensionHeader(Math.round(performance.timeOrigin) + (performance.now() | 0)));
    }

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

    const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg);

    // Send to interested subscribers
    const interestedAliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
    for (const alias of interestedAliases) {
      const datagram: Datagram = {
        type: extensionHeaders.length > 0 ? DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION : DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION,
        trackAlias: alias,
        groupId: targetTrack.largestGroupId,
        objectId: targetTrack.largestObjectId,
        publisherPriority: this.getPublisherPriority(targetTrack.type),
        extensionHeaders,
        payload: videoChunkBytes,
      };
      this.logger.debug(`Datagram payload size: ${videoChunkBytes.byteLength} bytes`);
      this.sendDatagram(datagram);
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
        this.logger.error(`groupId ${targetTrack.largestGroupId} not found`);
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
    const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg);

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
      const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg);

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
      const { videoChunkBytes, extensionHeaders } = this.prepareVideoChunkData(videoChunkMsg);
      const aliases = this.getAliasOfSubscribersWithLatestObjectFilter(targetTrack);
      for (const alias of aliases) {
        const datagram: Datagram = {
          type: extensionHeaders.length > 0 ? DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION : DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION,
          trackAlias: alias,
          groupId: targetTrack.largestGroupId,
          objectId: targetTrack.largestObjectId,
          publisherPriority: this.getPublisherPriority(targetTrack.type),
          extensionHeaders,
          payload: videoChunkBytes
        };
        this.sendDatagram(datagram);
      }
    }

    // Send END_OF_GROUP if this is the last object of the group
    if (targetTrack.largestObjectId !== undefined &&
        targetTrack.encoderConfig &&
        targetTrack.largestObjectId + 1 === targetTrack.encoderConfig.keyFrameDuration) {
      this.sendEndOfGroup(targetTrack.largestGroupId, targetTrack.largestObjectId + 1);
    }
  }
  private onSubscribeFirstSubscriberSideEffects(track: Track): void {
    const sideEffectByType: Record<Track['type'], () => void> = {
      video: () =>
        this.videoEncoders[track.name].postMessage({ type: 'encode', data: null }),
      audio: () =>
        this.audioEncoders[track.name].postMessage({ type: 'encode', data: null }),
      catalog: () =>
        this.warpCatalogManager.rebuildCatalog(this.namespace.join('/')),
    };

    sideEffectByType[track.type]?.();
  }
  // ------- Message Handlers for workers -------
  private communicatorMessageHandler(message: MessageEvent<CommunicatorMessageFromWorker>) {
    switch (message.data.type) {
    case 'datagramMaxSize':
      this.datagramMaxSize = message.data.data as number;
      this.logger.info(`Datagram max size set to ${this.datagramMaxSize}`);
      break;
    case 'ctrl-server-setup': {
      const msg = message.data.data as ServerSetup;
      if (!this.supportedVersions.includes(msg.selectedVersion)) {
        this.logger.error('Server does not support any of the versions we support');
        this.communicator.postMessage({ type: 'closeSession', data: null });
        break;
      }
      this.logger.info(`Setup successful with version ${msg.selectedVersion}`);
      this.selectedVersion = msg.selectedVersion;
      break;
    }
    case 'ctrl-announce-ok': {
      const msg = message.data.data as AnnounceOk;
      const namespace = this.requestIdToNamespace.get(msg.requestId);
      this.requestIdToNamespace.delete(msg.requestId);
      this.logger.info(`Announce with namespace ${namespace} successful`);
      break;
    }
    case 'ctrl-announce-error': {
      const msg = message.data.data as any;
      const errorNamespace = this.requestIdToNamespace.get(msg.requestId);
      this.requestIdToNamespace.delete(msg.requestId);
      this.logger.error(`Announce error for namespace ${errorNamespace}. reason: ${msg.reasonPhrase}`);
      break;
    }
    case 'ctrl-subscribe': {
      const msg = message.data.data as Subscribe;
      this.logger.info(`Subscribe request for track ${msg.trackName} with requestId ${msg.requestId} and alias ${msg.trackAlias}`);
      const targetTrack = this.trackManager.getTrack({ name: msg.trackName });
      if (!targetTrack) {
        const sub_err = serializeSubscribeError({
          requestId: msg.requestId,
          errorCode: SUBSCRIBE_ERROR_REASON.TRACK_DOES_NOT_EXIST,
          reasonPhrase: 'Track does not exist',
          trackAlias: msg.trackAlias
        });
        this.communicator.postMessage({ type: 'sendControlMessage', data: sub_err });
        break;
      }

      // Return SUBSCRIBE_OK before starting the stream
      const sub_ok = serializeSubscribeOk({ requestId: msg.requestId, expires: 0, groupOrder: msg.groupOrder || targetTrack.groupOrderPublisherPreference, contentExists: 0 });
      this.communicator.postMessage({ type: 'sendControlMessage', data: sub_ok });

      if (targetTrack.subscribers.length === 0) this.onSubscribeFirstSubscriberSideEffects(targetTrack);
      if (targetTrack.type === 'catalog') this.publishCatalog(msg.trackAlias);

      this.trackManager.addSubscriber({
        name: msg.trackName,
        requestId: msg.requestId,
        trackAlias: msg.trackAlias,
        filterType: msg.filterType,
      });
      this.logger.info(`Initialized subscription for track ${msg.trackName} with requestId ${msg.requestId} and alias ${msg.trackAlias}`);
      break;
    }
    case 'ctrl-unsubscribe': {
      const msg = message.data.data as Unsubscribe;
      this.removeSubscriber(msg.requestId);
      this.logger.debug(`Unsubscribe with requestId ${msg.requestId} successful`);
      break;
    }
    case 'error':
      this.logger.error(`Publisher communicator: ${message.data.data}`);
      break;
    case 'sessionClosed':
      this.communicator.terminate();
      for (const encoder of Object.values(this.videoEncoders)) {
        encoder.postMessage({ type: 'stop', data: null });
        encoder.terminate();
      }
      this.videoEncoders = {};
      for (const encoder of Object.values(this.audioEncoders)) {
        encoder.postMessage({ type: 'stop', data: null });
        encoder.terminate();
      }
      this.audioEncoders = {};
      break;
    default:
      this.logger.error(`Unexpected message type from communicator ${message.data.type}`);
      break;
    }
  }
  private videoEncoderMessageHandler(message: MessageEvent<VideoEncoderMessageFromWorker>) {
    const data = message.data as ThreadMessage;
    switch (data.type) {
    case 'videoChunk':
      const videoChunkMsg = data.data as MoqtailVideoChunkMessage;
      const targetTrack = this.trackManager.getTrack({ name: videoChunkMsg.trackName });
      if (!targetTrack) {
        this.logger.error(`Track ${videoChunkMsg.trackName} not found. Cannot send video chunk.`);
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
      this.logger.error(`Error from video encoder: ${message.data.data}`);
      break;
    }
  }
  private audioEncoderMessageHandler(message: MessageEvent<AudioEncoderMessageFromWorker>) {
    const data = message.data as ThreadMessage;
    switch (data.type) {
    // handling the latest encoded audio chunk
    case 'audioChunk':
      const audioChunkMsg = message.data.data as MoqtailAudioChunkMessage;
      const audioTrack = this.trackManager.getTrack({ name: audioChunkMsg.trackName });
      if (!audioTrack) {
        this.logger.error(`Track ${audioChunkMsg.trackName} not found. Cannot send audio chunk.`);
        return;
      }
      if (audioChunkMsg.chunk.type === 'key') {
        audioTrack.largestGroupId++;
        audioTrack.largestObjectId = 0;
      }
      const audioChunkBytes = serializeEncodedChunk(audioChunkMsg.chunk);
      const interestedAliases = this.getAliasOfSubscribersWithLatestObjectFilter(audioTrack);
      const extensionHeaders = audioChunkMsg.metadata.decoderConfig ? [audioDecoderConfigToExtensionHeader(audioChunkMsg.metadata.decoderConfig)]: [];
      for (const alias of interestedAliases) {
        const datagram: Datagram = {
          type: extensionHeaders.length > 0 ? DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION : DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION,
          trackAlias: alias,
          groupId: audioTrack.largestGroupId,
          objectId: audioTrack.largestObjectId,
          publisherPriority: this.getPublisherPriority(audioTrack.type),
          extensionHeaders: extensionHeaders,
          payload: audioChunkBytes,
        };
        this.sendDatagram(datagram);
      }
      audioTrack.largestObjectId++;
      break;
    case 'error':
      this.logger.error(`Error from audio encoder: ${message.data.data}`);
      break;
    }
  }
}
