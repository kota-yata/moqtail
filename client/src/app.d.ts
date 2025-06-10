import type { GROUP_ORDER, SUBSCRIBE_FILTER, ExtensionHeader, OBJECT_STATUS, Subscribe } from 'moqtail';
import type { Track } from './lib/trackManager';

declare global {
  type ThreadMessage = {
    type: string,
    data: any,
  }
  type ObjectValueList<T extends Record<any, any>> = T[keyof T];
  type PublisherInitProps = {
    serverUrl: string,
  };
  type SubscriberInitProps = {
    serverUrl: string,
    jitterBufferFrameSize?: number,
  };
  type RegisteredSubscription = {
    subscribe: Subscribe,
    subscribeOk: boolean,
    decoder: Worker,
    type: 'video' | 'audio';
  };
  // Types for publisher
  type MyEncoderConfig = {
    encoderConfig: VideoEncoderConfig | AudioEncoderConfig,
    keyFrameDuration?: number,
  }
  type Track = {
    namespace: string[];
    name: string;
    groups: Group[];
    groupOrderPublisherPreference: number = GROUP_ORDER.ASCENDING;
    objectForwardingPrefereces: 'Subgroup' | 'Datagram' | 'KeyFrameStream';
    largestGroupId?: number;
    largestObjectId?: number;
    isTrackEnded?: boolean;
    encoderConfig?: MyEncoderConfig;
    type: 'video' | 'audio';
    subscribers: { subscribeId: number, trackAlias: number, filterType: SUBSCRIBE_FILTER }[];
    streamCount?: number;
  }
  type MoqtailEncodedVideoChunkMetadata = EncodedVideoChunkMetadata & { frameType: EncodedVideoChunkType, totalChunkCount: number }
  type MoqtailVideoChunkMessage = { chunk: EncodedVideoChunk, metadata: MoqtailEncodedVideoChunkMetadata, trackName: string }
  type MoqtailAudioChunkMessage = { chunk: EncodedAudioChunk, metadata: EncodedAudioChunkMetadata, trackName: string }
  type ThreadMessage = {
    type: string,
    data: any,
  }
  interface RingBufferStats {
    capacity: number;
    writePos: number;
    readPos: number;
    size: number;
    available: number;
    free: number;
  }
}

export {};
