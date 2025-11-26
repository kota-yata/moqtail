import type {
  Datagram,
  SubgroupHeader,
  SubgroupObject,
  deserializeServerSetup,
  deserializeAnnounceOk,
  deserializeAnnounceError,
  deserializeSubscribe,
  deserializeSubscribeOk,
  deserializeSubscribeError,
  deserializeSubscribeDone,
  deserializeUnsubscribe,
} from 'moqtail';

export type CommunicatorMessageFromMainThread =
  | { type: 'startConnection'; data: string }
  | { type: 'sendControlMessage'; data: Uint8Array }
  | { type: 'createSubgroupStream'; data: { subgroupId: number; subgroupHeader: Uint8Array } }
  | { type: 'sendSubgroupObject'; data: { subgroupObject: Uint8Array; subgroupId: number; isLast?: boolean } }
  | { type: 'sendDatagram'; data: Uint8Array }
  | { type: 'closeSession'; data: null }
  | { type: 'startReadLoop'; data: null }
  | { type: 'startStreamReadLoop'; data: null }
  | { type: 'startDatagramReadLoop'; data: null };

type CtrlServerSetup = {
  type: 'ctrl-server-setup';
  data: Awaited<ReturnType<typeof deserializeServerSetup>>;
};
type CtrlAnnounceOk = {
  type: 'ctrl-announce-ok';
  data: Awaited<ReturnType<typeof deserializeAnnounceOk>>;
};
type CtrlAnnounceError = {
  type: 'ctrl-announce-error';
  data: Awaited<ReturnType<typeof deserializeAnnounceError>>;
};
type CtrlSubscribe = {
  type: 'ctrl-subscribe';
  data: Awaited<ReturnType<typeof deserializeSubscribe>>;
};
type CtrlSubscribeOk = {
  type: 'ctrl-subscribe-ok';
  data: Awaited<ReturnType<typeof deserializeSubscribeOk>>;
};
type CtrlSubscribeError = {
  type: 'ctrl-subscribe-error';
  data: Awaited<ReturnType<typeof deserializeSubscribeError>>;
};
type CtrlSubscribeDone = {
  type: 'ctrl-subscribe-done';
  data: Awaited<ReturnType<typeof deserializeSubscribeDone>>;
};
type CtrlUnsubscribe = {
  type: 'ctrl-unsubscribe';
  data: Awaited<ReturnType<typeof deserializeUnsubscribe>>;
};

export type CommunicatorControlMessage =
  | CtrlServerSetup
  | CtrlAnnounceOk
  | CtrlAnnounceError
  | CtrlSubscribe
  | CtrlSubscribeOk
  | CtrlSubscribeError
  | CtrlSubscribeDone
  | CtrlUnsubscribe;

export type CommunicatorMessageFromWorker =
  | { type: 'error'; data: string }
  | { type: 'sessionClosed' }
  | { type: 'datagramMaxSize'; data: number }
  | { type: 'subgroupObject'; data: { header: SubgroupObject; encodedChunkInit: EncodedVideoChunkInit | EncodedAudioChunkInit; trackAlias: number; subgroupId: number; groupId: number } }
  | { type: 'subgroupObjectStatus'; data: { header: SubgroupObject; subgroupId: number } }
  | { type: 'datagramObject'; data: { header: Datagram; payload: Uint8Array } }
  | CommunicatorControlMessage
  | { type: 'subgroup-header'; data: SubgroupHeader };
