import {
  CONTROL_MESSAGE,
  readControlMessageType,
  serializeClientSetup, deserializeClientSetup,
  serializeServerSetup, deserializeServerSetup,
  serializeGoaway, deserializeGoaway,
  serializeMaxRequestId, deserializeMaxRequestId,
  serializeRequestsBlocked, deserializeRequestsBlocked,

  serializeAnnounce, deserializeAnnounce,
  serializeAnnounceOk, deserializeAnnounceOk,
  serializeAnnounceError, deserializeAnnounceError,
  serializeAnnounceCancel, deserializeAnnounceCancel,
  serializeUnannounce, deserializeUnannounce,

  serializeSubscribe, deserializeSubscribe,
  serializeSubscribeOk, deserializeSubscribeOk,
  serializeSubscribeError, deserializeSubscribeError,
  serializeSubscribeDone, deserializeSubscribeDone,
  serializeSubscribeUpdate, deserializeSubscribeUpdate,
  serializeUnsubscribe, deserializeUnsubscribe,

  serializeSubscribeAnnounces, deserializeSubscribeAnnounces,
  serializeSubscribeAnnouncesOk, deserializeSubscribeAnnouncesOk,
  serializeSubscribeAnnouncesError, deserializeSubscribeAnnouncesError,
  serializeUnsubscribeAnnounces, deserializeUnsubscribeAnnounces,

  serializeFetch, deserializeFetch,
  serializeFetchOk, deserializeFetchOk,
  serializeFetchError, deserializeFetchError,
  serializeFetchCancel, deserializeFetchCancel,

  serializeTrackStatusRequest, deserializeTrackStatusRequest,
  serializeTrackStatus, deserializeTrackStatus,
} from '../src/index';

import { getUint16, buffRead } from 'bytes';

const $ = (id: string) => document.getElementById(id)!;
const logEl = $("logs");

const log = (msg: string, obj?: unknown) => {
  const time = new Date().toISOString().split("T")[1]!.replace("Z", "");
  if (obj !== undefined) {
    (logEl as HTMLDivElement).textContent += `[${time}] ${msg}: ${JSON.stringify(obj)}\n`;
  } else {
    (logEl as HTMLDivElement).textContent += `[${time}] ${msg}\n`;
  }
  (logEl as HTMLDivElement).scrollTop = (logEl as HTMLDivElement).scrollHeight;
};

const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');

type MsgDef<T> = {
  key: string;
  type: number;
  serialize: (props: T) => Uint8Array;
  deserialize: (r: ReadableStream) => Promise<unknown>;
  example: T;
};

const messages: Array<MsgDef<any>> = [
  { key: 'CLIENT_SETUP', type: CONTROL_MESSAGE.CLIENT_SETUP, serialize: serializeClientSetup, deserialize: deserializeClientSetup, example: { supportedVersions: [0xff00000B] } },
  { key: 'SERVER_SETUP', type: CONTROL_MESSAGE.SERVER_SETUP, serialize: serializeServerSetup, deserialize: deserializeServerSetup, example: { selectedVersion: 0xff00000B, parameters: [] } },
  { key: 'GOAWAY', type: CONTROL_MESSAGE.GOAWAY, serialize: serializeGoaway, deserialize: deserializeGoaway, example: { newSessionUri: '' } },
  { key: 'MAX_REQUEST_ID', type: CONTROL_MESSAGE.MAX_REQUEST_ID, serialize: serializeMaxRequestId, deserialize: deserializeMaxRequestId, example: { requestId: 0 } },
  { key: 'REQUESTS_BLOCKED', type: CONTROL_MESSAGE.REQUESTS_BLOCKED, serialize: serializeRequestsBlocked, deserialize: deserializeRequestsBlocked, example: { maxrequestId: 0 } },
  { key: 'ANNOUNCE', type: CONTROL_MESSAGE.ANNOUNCE, serialize: serializeAnnounce, deserialize: deserializeAnnounce, example: { requestId: 0, trackNamespace: ["moq"] } },
  { key: 'ANNOUNCE_OK', type: CONTROL_MESSAGE.ANNOUNCE_OK, serialize: serializeAnnounceOk, deserialize: deserializeAnnounceOk, example: { requestId: 0 } },
  { key: 'ANNOUNCE_ERROR', type: CONTROL_MESSAGE.ANNOUNCE_ERROR, serialize: serializeAnnounceError, deserialize: deserializeAnnounceError, example: { requestId: 0, errorCode: 0, reasonPhrase: '' } },
  { key: 'ANNOUNCE_CANCEL', type: CONTROL_MESSAGE.ANNOUNCE_CANCEL, serialize: serializeAnnounceCancel, deserialize: deserializeAnnounceCancel, example: { trackNamespace: ["moq"], errorCode: 0, reasonPhrase: '' } },
  { key: 'UNANNOUNCE', type: CONTROL_MESSAGE.UNANNOUNCE, serialize: serializeUnannounce, deserialize: deserializeUnannounce, example: { trackNamespace: ["moq"] } },

  { key: 'SUBSCRIBE', type: CONTROL_MESSAGE.SUBSCRIBE, serialize: serializeSubscribe, deserialize: deserializeSubscribe, example: { requestId: 0, trackAlias: 1, trackNamespace: ["moq"], trackName: "video", subscriberPriority: 0, groupOrder: 1, forward: 1, filterType: 3, startGroup: 0, startObject: 0 }},
  { key: 'SUBSCRIBE_OK', type: CONTROL_MESSAGE.SUBSCRIBE_OK, serialize: serializeSubscribeOk, deserialize: deserializeSubscribeOk, example: { requestId: 0, expires: 60, groupOrder: 1, contentExists: 0 } },
  { key: 'SUBSCRIBE_ERROR', type: CONTROL_MESSAGE.SUBSCRIBE_ERROR, serialize: serializeSubscribeError, deserialize: deserializeSubscribeError, example: { requestId: 0, errorCode: 0, reasonPhrase: '', trackAlias: 1 } },
  { key: 'SUBSCRIBE_DONE', type: CONTROL_MESSAGE.SUBSCRIBE_DONE, serialize: serializeSubscribeDone, deserialize: deserializeSubscribeDone, example: { requestId: 0, statusCode: 0, streamCount: 0, reasonPhrase: '' } },
  { key: 'SUBSCRIBE_UPDATE', type: CONTROL_MESSAGE.SUBSCRIBE_UPDATE, serialize: serializeSubscribeUpdate, deserialize: deserializeSubscribeUpdate, example: { requestId: 0, startGroup: 0, startObject: 0, endGroup: 0, subscriberPriority: 0 } },
  { key: 'UNSUBSCRIBE', type: CONTROL_MESSAGE.UNSUBSCRIBE, serialize: serializeUnsubscribe, deserialize: deserializeUnsubscribe, example: 2 },

  { key: 'SUBSCRIBE_ANNOUNCES', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, serialize: serializeSubscribeAnnounces, deserialize: deserializeSubscribeAnnounces, example: { requestId: 0, trackNamespacePrefix: ["moq"] } },
  { key: 'SUBSCRIBE_ANNOUNCES_OK', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_OK, serialize: serializeSubscribeAnnouncesOk, deserialize: deserializeSubscribeAnnouncesOk, example: { requestId: 0 } },
  { key: 'SUBSCRIBE_ANNOUNCES_ERROR', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR, serialize: serializeSubscribeAnnouncesError, deserialize: deserializeSubscribeAnnouncesError, example: { requestId: 0, errorCode: 0, reasonPhrase: '' } },
  { key: 'UNSUBSCRIBE_ANNOUNCES', type: CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES, serialize: serializeUnsubscribeAnnounces, deserialize: deserializeUnsubscribeAnnounces, example: ["moq"] },

  { key: 'FETCH', type: CONTROL_MESSAGE.FETCH, serialize: serializeFetch, deserialize: deserializeFetch, example: { requestId: 0, subscriberPriority: 0, groupOrder: 1, fetchType: 1, trackNamespace: ["moq"], trackName: "video", startGroup: 0, startObject: 0, endGroup: 0, endObject: 0 } },
  { key: 'FETCH_OK', type: CONTROL_MESSAGE.FETCH_OK, serialize: serializeFetchOk, deserialize: deserializeFetchOk, example: { requestId: 0, groupOrder: 1, endOfTrack: 0, largestGroupId: 0, largestObjectId: 0 } },
  { key: 'FETCH_ERROR', type: CONTROL_MESSAGE.FETCH_ERROR, serialize: serializeFetchError, deserialize: deserializeFetchError, example: { requestId: 0, errorCode: 0, reasonPhrase: '' } },
  { key: 'FETCH_CANCEL', type: CONTROL_MESSAGE.FETCH_CANCEL, serialize: serializeFetchCancel, deserialize: deserializeFetchCancel, example: 2 },

  { key: 'TRACK_STATUS_REQUEST', type: CONTROL_MESSAGE.TRACK_STATUS_REQUEST, serialize: serializeTrackStatusRequest, deserialize: deserializeTrackStatusRequest, example: { requestId: 0, trackNamespace: ["moq"], trackName: "video" } },
  { key: 'TRACK_STATUS', type: CONTROL_MESSAGE.TRACK_STATUS, serialize: serializeTrackStatus, deserialize: deserializeTrackStatus, example: { requestId: 0, statusCode: 0, largestLocation: { group: 0, object: 0 } } }
];

const typeToMessage = new Map(messages.map(m => [m.type, m]));
const keyToMessage = new Map(messages.map(m => [m.key, m]));

let transport: WebTransport | null = null;
let controlStream: WebTransportBidirectionalStream | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let reader: ReadableStream<Uint8Array> | null = null;
let readerLoopAbort: AbortController | null = null;

function setConnState(connected: boolean) {
  ( $("connectBtn") as HTMLButtonElement ).disabled = connected;
  ( $("disconnectBtn") as HTMLButtonElement ).disabled = !connected;
  ( $("openControlBtn") as HTMLButtonElement ).disabled = !connected;
  $("status").textContent = connected ? "Connected" : "Disconnected";
}

function setControlState(open: boolean) {
  ( $("openControlBtn") as HTMLButtonElement ).disabled = !!open || !transport;
  ( $("closeControlBtn") as HTMLButtonElement ).disabled = !open;
  ( $("sendBtn") as HTMLButtonElement ).disabled = !open;
  $("controlStatus").textContent = open ? "Open" : "No stream";
}

function populateMessageSelect() {
  const sel = $("message") as HTMLSelectElement;
  sel.innerHTML = '';
  for (const m of messages) {
    const opt = document.createElement('option');
    opt.value = m.key;
    opt.textContent = `${m.key} (0x${m.type.toString(16)})`;
    sel.appendChild(opt);
  }
  sel.value = 'CLIENT_SETUP';
  onMessageChange();
}

function onMessageChange() {
  const key = ( $("message") as HTMLSelectElement ).value;
  const m = keyToMessage.get(key)!;
  const example = JSON.stringify(m.example, null, 2);
  ( $("props") as HTMLTextAreaElement ).value = example;
}

async function connect() {
  const url = ( $("url") as HTMLInputElement ).value.trim();
  if (!url) { alert('Enter WebTransport URL'); return; }
  try {
    transport = new WebTransport(url);
    $("status").textContent = 'Connecting...';
    await transport.ready;
    setConnState(true);
    log('Connected to', url);

    transport.closed
      .then(() => { log('Transport closed'); setConnState(false); setControlState(false); })
      .catch((e) => { log('Transport closed with error', String(e)); setConnState(false); setControlState(false); });
  } catch (e) {
    log('Connect failed', String(e));
    setConnState(false);
  }
}

async function disconnect() {
  try {
    if (readerLoopAbort) readerLoopAbort.abort();
    if (writer) { try { await writer.close(); } catch { /* ignore */ } }
    if (controlStream?.readable) { try { await controlStream.readable.cancel(); } catch { /* ignore */ } }
    if (controlStream?.writable) { try { await controlStream.writable.close(); } catch { /* ignore */ } }
  } catch { /* ignore */ }
  writer = null; reader = null; controlStream = null;
  setControlState(false);
  if (transport) {
    try { await transport.close(); } catch { /* ignore */ }
    transport = null;
  }
  setConnState(false);
}

async function openControlStream() {
  if (!transport) return;
  try {
    controlStream = await transport.createBidirectionalStream();
    writer = controlStream.writable.getWriter();
    reader = controlStream.readable;
    setControlState(true);
    log('Control stream opened');
    startReaderLoop(reader);
  } catch (e) {
    log('Open control stream failed', String(e));
  }
}

async function closeControlStream() {
  if (!controlStream) return;
  try { if (readerLoopAbort) readerLoopAbort.abort(); } catch {}
  try { await writer?.close(); } catch {}
  try { await controlStream.writable?.close(); } catch {}
  try { await controlStream.readable?.cancel(); } catch {}
  controlStream = null; writer = null; reader = null;
  setControlState(false);
  log('Control stream closed');
}

function messageNameFromType(typeVal: number) {
  const entry = Object.entries(CONTROL_MESSAGE).find(([,v]) => v === typeVal);
  return entry ? entry[0] : `UNKNOWN(0x${typeVal.toString(16)})`;
}

function startReaderLoop(stream: ReadableStream<Uint8Array>) {
  const abort = new AbortController();
  readerLoopAbort = abort;
  (async () => {
    try {
      while (!abort.signal.aborted) {
        const typeVal = await readControlMessageType(stream as unknown as ReadableStream);
        const msgInfo = typeToMessage.get(typeVal);
        const name = messageNameFromType(typeVal);
        if (!msgInfo) {
          try { const len = await getUint16(stream as unknown as ReadableStream); await buffRead(stream as unknown as ReadableStream, len); } catch {}
          log(`Received ${name} (skipped unknown message body)`);
          continue;
        }
        try {
          const parsed = await msgInfo.deserialize(stream as unknown as ReadableStream);
          log(`Received ${name}`, parsed);
        } catch (e) {
          log(`Failed to deserialize ${name}`, String(e));
        }
      }
    } catch (e) {
      if (!abort.signal.aborted) log('Reader loop error', String(e));
    }
  })();
}

async function onSend() {
  if (!writer) { alert('Open control stream first'); return; }
  const key = ( $("message") as HTMLSelectElement ).value;
  const m = keyToMessage.get(key)!;
  let props: any;
  try {
    props = JSON.parse(( $("props") as HTMLTextAreaElement ).value || 'null');
  } catch (e: any) {
    alert('Invalid JSON: ' + e.message);
    return;
  }
  // Enforce requestId parity for client-sent messages
  const toEven = (n: number) => (n % 2 === 0 ? n : n + 1);
  if (typeof props === 'number') {
    props = toEven(props);
  } else if (props && typeof props === 'object') {
    if ('requestId' in props && typeof props.requestId === 'number') {
      props.requestId = toEven(props.requestId);
    }
    if ('joiningRequestId' in props && typeof props.joiningRequestId === 'number') {
      props.joiningRequestId = toEven(props.joiningRequestId);
    }
  }
  try {
    const bytes = m.serialize(props);
    ( $("lastHex") as HTMLTextAreaElement ).value = toHex(bytes);
    await writer.write(bytes);
    log(`Sent ${m.key}`, props);
  } catch (e) {
    log(`Serialize/Send failed for ${m.key}`, String(e));
  }
}

($("connectBtn") as HTMLButtonElement).addEventListener('click', connect);
($("disconnectBtn") as HTMLButtonElement).addEventListener('click', disconnect);
($("openControlBtn") as HTMLButtonElement).addEventListener('click', openControlStream);
($("closeControlBtn") as HTMLButtonElement).addEventListener('click', closeControlStream);
($("sendBtn") as HTMLButtonElement).addEventListener('click', onSend);
($("message") as HTMLSelectElement).addEventListener('change', onMessageChange);

function populateDefaultUrl() {
  // Optional: set a default test URL
}

populateMessageSelect();
populateDefaultUrl();

