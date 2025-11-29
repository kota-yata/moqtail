import type { deserializeServerSetup } from '../messages/serverSetup';
import type { deserializeAnnounceOk } from '../messages/announceOk';
import type { deserializeAnnounceError } from '../messages/announceError';
import type { deserializeSubscribe } from '../messages/subscribe';
import type { deserializeSubscribeOk } from '../messages/subscribeOk';
import type { deserializeSubscribeError } from '../messages/subscribeError';
import type { deserializeSubscribeDone } from '../messages/subscribeDone';
import type { deserializeUnsubscribe } from '../messages/unsubscribe';
import type { SubgroupHeader } from '../dataStreams/subgroupHeader';
import type { SubgroupObject } from '../dataStreams/subgroupObject';
import type { Datagram } from '../dataStreams/datagram';

export type TransportRole = 'subscriber' | 'publisher' | 'both';

export type TransportOptions = {
  role?: TransportRole;
  enableDatagrams?: boolean;
  autoStartControlRead?: boolean;
  autoStartStreamRead?: boolean;
  autoStartDatagramRead?: boolean;
  congestionControl?: 'throughput' | 'low-latency';
};

export type CtrlServerSetup = {
  type: 'ctrl:server-setup';
  data: Awaited<ReturnType<typeof deserializeServerSetup>>;
};
export type CtrlAnnounceOk = {
  type: 'ctrl:announce-ok';
  data: Awaited<ReturnType<typeof deserializeAnnounceOk>>;
};
export type CtrlAnnounceError = {
  type: 'ctrl:announce-error';
  data: Awaited<ReturnType<typeof deserializeAnnounceError>>;
};
export type CtrlSubscribe = {
  type: 'ctrl:subscribe';
  data: Awaited<ReturnType<typeof deserializeSubscribe>>;
};
export type CtrlSubscribeOk = {
  type: 'ctrl:subscribe-ok';
  data: Awaited<ReturnType<typeof deserializeSubscribeOk>>;
};
export type CtrlSubscribeError = {
  type: 'ctrl:subscribe-error';
  data: Awaited<ReturnType<typeof deserializeSubscribeError>>;
};
export type CtrlSubscribeDone = {
  type: 'ctrl:subscribe-done';
  data: Awaited<ReturnType<typeof deserializeSubscribeDone>>;
};
export type CtrlUnsubscribe = {
  type: 'ctrl:unsubscribe';
  data: Awaited<ReturnType<typeof deserializeUnsubscribe>>;
};

export type TransportControlEvent =
  | CtrlServerSetup
  | CtrlAnnounceOk
  | CtrlAnnounceError
  | CtrlSubscribe
  | CtrlSubscribeOk
  | CtrlSubscribeError
  | CtrlSubscribeDone
  | CtrlUnsubscribe;

export type TransportEvent =
  | { type: 'error'; data: any }
  | { type: 'session:connected' }
  | { type: 'session:closed' }
  | { type: 'subgroup:header'; data: SubgroupHeader }
  | {
      type: 'subgroup:object';
      data: {
        header: SubgroupObject;
        encodedChunkInit: EncodedVideoChunkInit | EncodedAudioChunkInit;
        trackAlias: number;
        subgroupId: number;
        groupId: number;
      };
    }
  | { type: 'subgroup:object-status'; data: { header: SubgroupObject; subgroupId: number } }
  | { type: 'datagram:max-size'; data: number }
  | { type: 'datagram:object'; data: { header: Datagram; payload: Uint8Array } }
  | TransportControlEvent;

export type TransportMessageFromMainThread =
  | { type: 'startConnection'; data: { url: string; options?: TransportOptions } }
  | { type: 'sendControlMessage'; data: Uint8Array }
  | { type: 'createSubgroupStream'; data: { subgroupId: number; subgroupHeader: Uint8Array } }
  | { type: 'sendSubgroupObject'; data: { subgroupObject: Uint8Array; subgroupId: number; isLast?: boolean } }
  | { type: 'sendDatagram'; data: Uint8Array }
  | { type: 'startControlReadLoop'; data: null }
  | { type: 'startStreamReadLoop'; data: null }
  | { type: 'startDatagramReadLoop'; data: null }
  | { type: 'closeSession'; data: null };

export interface MoqTransport {
  connect(url: string, opts?: Partial<TransportOptions>): Promise<void>;
  close(): Promise<void>;
  sendControlMessage(payload: Uint8Array): Promise<void>;
  startControlReadLoop(): void;
  startStreamReadLoop(): void;
  createSubgroupStream(input: { subgroupId: number; subgroupHeader: Uint8Array }): Promise<void>;
  sendSubgroupObject(input: { subgroupId: number; subgroupObject: Uint8Array; isLast?: boolean }): Promise<void>;
  sendDatagram(payload: Uint8Array): Promise<void>;
  startDatagramReadLoop(): void;
  on<E extends TransportEvent['type']>(type: E, handler: (evt: Extract<TransportEvent, { type: E }>) => void): () => void;
}
