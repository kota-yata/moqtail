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
import type { TransportError } from './error';

/**
 * Role of the transport. Controls which MOQT capabilities are enabled.
 * - `subscriber`: receive-only
 * - `publisher`: send-only
 * - `both`: bidirectional
 */
export type TransportRole = 'subscriber' | 'publisher' | 'both';

/**
 * Transport configuration options.
 */
export type TransportOptions = {
  /** Enable publishing, subscribing or both. Default: `subscriber`. */
  role?: TransportRole;
  /** Enable QUIC datagrams support. Default: `false`. */
  enableDatagrams?: boolean;
  /** Start the control stream read loop automatically. Default: `true`. */
  autoStartControlRead?: boolean;
  /** Start the incoming unidirectional stream read loop automatically. Default: `true`. */
  autoStartStreamRead?: boolean;
  /** Start the datagram read loop automatically. Default: `false`. */
  autoStartDatagramRead?: boolean;
  /** WebTransport congestion control mode. Default: `throughput`. */
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

/**
 * Events emitted by the transport worker to the main thread.
 */
export interface ErrorEvent {
  type: 'error';
  data: TransportError;
}

export interface SessionConnectedEvent {
  type: 'session:connected';
}

export interface SessionClosedEvent {
  type: 'session:closed';
}

export interface SubgroupHeaderEvent {
  type: 'subgroup:header';
  data: SubgroupHeader;
}

export interface SubgroupObjectEvent {
  type: 'subgroup:object';
  data: {
    header: SubgroupObject;
    encodedChunkInit: EncodedVideoChunkInit | EncodedAudioChunkInit;
    trackAlias: number;
    subgroupId: number;
    groupId: number;
  };
}

export interface SubgroupObjectStatusEvent {
  type: 'subgroup:object-status';
  data: { header: SubgroupObject; subgroupId: number };
}

export interface DatagramMaxSizeEvent {
  type: 'datagram:max-size';
  data: number;
}

export interface DatagramObjectEvent {
  type: 'datagram:object';
  data: { header: Datagram; payload: Uint8Array };
}

export type TransportEvent =
  | ErrorEvent
  | SessionConnectedEvent
  | SessionClosedEvent
  | SubgroupHeaderEvent
  | SubgroupObjectEvent
  | SubgroupObjectStatusEvent
  | DatagramMaxSizeEvent
  | DatagramObjectEvent
  | TransportControlEvent;

/**
 * Messages sent from the main thread to the transport worker.
 */
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

/**
 * High-level client API for interacting with a MOQT transport worker.
 */
export interface MoqTransport {
  /**
   * Establish a WebTransport session and initialize control/datagram streams.
   * Resolves when connected; emits `session:connected` or `error` events.
   */
  connect(url: string, opts?: Partial<TransportOptions>): Promise<void>;
  /** Close the current session and release resources. */
  close(): Promise<void>;
  /** Send a raw control-plane MOQT message over the bidirectional stream. */
  sendControlMessage(payload: Uint8Array): Promise<void>;
  /** Manually start the control read loop if auto-start was disabled. */
  startControlReadLoop(): void;
  /** Manually start reading incoming unidirectional subgroup streams. */
  startStreamReadLoop(): void;
  /**
   * Create a unidirectional stream for a subgroup and write its header.
   * Required before sending subgroup objects.
   */
  createSubgroupStream(input: { subgroupId: number; subgroupHeader: Uint8Array }): Promise<void>;
  /**
   * Send a subgroup object over the previously created unidirectional stream.
   * Optionally close the stream when `isLast` is true.
   */
  sendSubgroupObject(input: { subgroupId: number; subgroupObject: Uint8Array; isLast?: boolean }): Promise<void>;
  /** Send a QUIC datagram payload when datagrams are enabled. */
  sendDatagram(payload: Uint8Array): Promise<void>;
  /** Manually start the datagram read loop if auto-start was disabled. */
  startDatagramReadLoop(): void;
  /**
   * Subscribe to a typed transport event. Returns an unsubscribe function.
   */
  on<E extends TransportEvent['type']>(type: E, handler: (evt: Extract<TransportEvent, { type: E }>) => void): () => void;
}
