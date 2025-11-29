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
} from 'moqtail';

import { getUint16, buffRead } from 'bytes';

const $ = (id) => document.getElementById(id);
const logEl = $("logs");

const log = (msg, obj) => {
  const time = new Date().toISOString().split("T")[1].replace("Z", "");
  if (obj !== undefined) {
    logEl.textContent += `[${time}] ${msg}: ${JSON.stringify(obj)}\n`;
  } else {
    logEl.textContent += `[${time}] ${msg}\n`;
  }
  logEl.scrollTop = logEl.scrollHeight;
};

const toHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');

const messages = [
  { key: 'CLIENT_SETUP', type: CONTROL_MESSAGE.CLIENT_SETUP, serialize: serializeClientSetup, deserialize: deserializeClientSetup, example: { supportedVersions: [0xff00000B], params: [] } },
  { key: 'SERVER_SETUP', type: CONTROL_MESSAGE.SERVER_SETUP, serialize: serializeServerSetup, deserialize: deserializeServerSetup, example: { selectedVersion: 0xff00000B, parameters: [] } },
  { key: 'GOAWAY', type: CONTROL_MESSAGE.GOAWAY, serialize: serializeGoaway, deserialize: deserializeGoaway, example: { lastGoodRequestId: 1, reasonCode: 0, reasonPhrase: '' } },
  { key: 'MAX_REQUEST_ID', type: CONTROL_MESSAGE.MAX_REQUEST_ID, serialize: serializeMaxRequestId, deserialize: deserializeMaxRequestId, example: { maxRequestId: 100 } },
  { key: 'REQUESTS_BLOCKED', type: CONTROL_MESSAGE.REQUESTS_BLOCKED, serialize: serializeRequestsBlocked, deserialize: deserializeRequestsBlocked, example: { maxRequestId: 1 } },

  { key: 'ANNOUNCE', type: CONTROL_MESSAGE.ANNOUNCE, serialize: serializeAnnounce, deserialize: deserializeAnnounce, example: { requestId: 0, trackNamespace: ["moq", "demo"], parameters: [] } },
  { key: 'ANNOUNCE_OK', type: CONTROL_MESSAGE.ANNOUNCE_OK, serialize: serializeAnnounceOk, deserialize: deserializeAnnounceOk, example: { requestId: 1 } },
  { key: 'ANNOUNCE_ERROR', type: CONTROL_MESSAGE.ANNOUNCE_ERROR, serialize: serializeAnnounceError, deserialize: deserializeAnnounceError, example: { requestId: 1, errorCode: 0, reasonPhrase: '' } },
  { key: 'ANNOUNCE_CANCEL', type: CONTROL_MESSAGE.ANNOUNCE_CANCEL, serialize: serializeAnnounceCancel, deserialize: deserializeAnnounceCancel, example: { trackNamespace: ["moq", "demo"], errorCode: 0, reasonPhrase: {  } } },
  { key: 'UNANNOUNCE', type: CONTROL_MESSAGE.UNANNOUNCE, serialize: serializeUnannounce, deserialize: deserializeUnannounce, example: { trackNamespace: ["moq", "demo"] } },

  { key: 'SUBSCRIBE', type: CONTROL_MESSAGE.SUBSCRIBE, serialize: serializeSubscribe, deserialize: deserializeSubscribe, example: { requestId: 0, trackAlias: 1, trackNamespace: ["moq","demo"], trackName: "video", subscriberPriority: 0, groupOrder: 1, forward: 1, filterType: 3, startGroup: 0, startObject: 0, endGroup: 0, parameters: [] } },
  { key: 'SUBSCRIBE_OK', type: CONTROL_MESSAGE.SUBSCRIBE_OK, serialize: serializeSubscribeOk, deserialize: deserializeSubscribeOk, example: { requestId: 1, expires: 60, groupOrder: 1, contentExists: 1, largestGroupId: 0, largestObjectId: 0, parameters: [] } },
  { key: 'SUBSCRIBE_ERROR', type: CONTROL_MESSAGE.SUBSCRIBE_ERROR, serialize: serializeSubscribeError, deserialize: deserializeSubscribeError, example: { requestId: 1, trackAlias: 1, errorCode: 0, reasonPhrase: '' } },
  { key: 'SUBSCRIBE_DONE', type: CONTROL_MESSAGE.SUBSCRIBE_DONE, serialize: serializeSubscribeDone, deserialize: deserializeSubscribeDone, example: { requestId: 1, statusCode: 0, streamCount: 0, reasonPhrase: '' } },
  { key: 'SUBSCRIBE_UPDATE', type: CONTROL_MESSAGE.SUBSCRIBE_UPDATE, serialize: serializeSubscribeUpdate, deserialize: deserializeSubscribeUpdate, example: { requestId: 0, startGroup: 0, startObject: 0, endGroup: 0, subscriberPriority: 0, parameters: [] } },
  { key: 'UNSUBSCRIBE', type: CONTROL_MESSAGE.UNSUBSCRIBE, serialize: serializeUnsubscribe, deserialize: deserializeUnsubscribe, example: 1 },

  { key: 'SUBSCRIBE_ANNOUNCES', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, serialize: serializeSubscribeAnnounces, deserialize: deserializeSubscribeAnnounces, example: { requestId: 0, trackNamespacePrefix: ["moq"], parameters: [] } },
  { key: 'SUBSCRIBE_ANNOUNCES_OK', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_OK, serialize: serializeSubscribeAnnouncesOk, deserialize: deserializeSubscribeAnnouncesOk, example: ["moq"] },
  { key: 'SUBSCRIBE_ANNOUNCES_ERROR', type: CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR, serialize: serializeSubscribeAnnouncesError, deserialize: deserializeSubscribeAnnouncesError, example: { requestId: 1, errorCode: 0, reasonPhrase: '' } },
  { key: 'UNSUBSCRIBE_ANNOUNCES', type: CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES, serialize: serializeUnsubscribeAnnounces, deserialize: deserializeUnsubscribeAnnounces, example: ["moq"] },

  { key: 'FETCH', type: CONTROL_MESSAGE.FETCH, serialize: serializeFetch, deserialize: deserializeFetch, example: { requestId: 0, subscriberPriority: 0, groupOrder: 1, fetchType: 1, trackNamespace: ["moq","demo"], trackName: "video", startGroup: 0, startObject: 0, endGroup: 0, endObject: 0, parameters: [] } },
  { key: 'FETCH_OK', type: CONTROL_MESSAGE.FETCH_OK, serialize: serializeFetchOk, deserialize: deserializeFetchOk, example: { requestId: 1, groupOrder: 1, endOfTrack: 0, largestGroupId: 0, largestObjectId: 0, parameters: [] } },
  { key: 'FETCH_ERROR', type: CONTROL_MESSAGE.FETCH_ERROR, serialize: serializeFetchError, deserialize: deserializeFetchError, example: { requestId: 1, errorCode: 0, reasonPhrase: '' } },
  { key: 'FETCH_CANCEL', type: CONTROL_MESSAGE.FETCH_CANCEL, serialize: serializeFetchCancel, deserialize: deserializeFetchCancel, example: 1 },

  { key: 'TRACK_STATUS_REQUEST', type: CONTROL_MESSAGE.TRACK_STATUS_REQUEST, serialize: serializeTrackStatusRequest, deserialize: deserializeTrackStatusRequest, example: { requestId: 1, trackNamespace: ["moq","demo"], trackName: "video", parameters: [] } },
  { key: 'TRACK_STATUS', type: CONTROL_MESSAGE.TRACK_STATUS, serialize: serializeTrackStatus, deserialize: deserializeTrackStatus, example: { requestId: 1, statusCode: 0, largestLocation: { group: 0, object: 0 }, parameters: [] } }
];

const typeToMessage = new Map(messages.map(m => [m.type, m]));
const keyToMessage = new Map(messages.map(m => [m.key, m]));

let transport = null;
let controlStream = null;
let writer = null;
let reader = null;
let readerLoopAbort = null;

function setConnState(connected) {
  $("connectBtn").disabled = connected;
  $("disconnectBtn").disabled = !connected;
  $("openControlBtn").disabled = !connected;
  $("status").textContent = connected ? "Connected" : "Disconnected";
}

function setControlState(open) {
  $("openControlBtn").disabled = !!open || !transport;
  $("closeControlBtn").disabled = !open;
  $("sendBtn").disabled = !open;
  $("controlStatus").textContent = open ? "Open" : "No stream";
}

function populateMessageSelect() {
  const sel = $("message");
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
  const key = $("message").value;
  const m = keyToMessage.get(key);
  const example = JSON.stringify(m.example, null, 2);
  $("props").value = example;
}

async function connect() {
  const url = $("url").value.trim();
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

function messageNameFromType(typeVal) {
  const entry = Object.entries(CONTROL_MESSAGE).find(([,v]) => v === typeVal);
  return entry ? entry[0] : `UNKNOWN(0x${typeVal.toString(16)})`;
}

function startReaderLoop(stream) {
  const abort = new AbortController();
  readerLoopAbort = abort;
  (async () => {
    try {
      while (!abort.signal.aborted) {
        const typeVal = await readControlMessageType(stream);
        const msgInfo = typeToMessage.get(typeVal);
        const name = messageNameFromType(typeVal);
        if (!msgInfo) {
          try { const len = await getUint16(stream); await buffRead(stream, len); } catch {}
          log(`Received ${name} (skipped unknown message body)`);
          continue;
        }
        try {
          const parsed = await msgInfo.deserialize(stream);
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
  const key = $("message").value;
  const m = keyToMessage.get(key);
  if (!m) return;
  let props;
  try {
    props = JSON.parse($("props").value || 'null');
  } catch (e) {
    alert('Invalid JSON: ' + e.message);
    return;
  }
  try {
    const bytes = m.serialize(props);
    $("lastHex").value = toHex(bytes);
    await writer.write(bytes);
    log(`Sent ${m.key}`, props);
  } catch (e) {
    log(`Serialize/Send failed for ${m.key}`, String(e));
  }
}

$("connectBtn").addEventListener('click', connect);
$("disconnectBtn").addEventListener('click', disconnect);
$("openControlBtn").addEventListener('click', openControlStream);
$("closeControlBtn").addEventListener('click', closeControlStream);
$("sendBtn").addEventListener('click', onSend);
$("message").addEventListener('change', onMessageChange);

function populateDefaultUrl() {
  // Optional: set a default test URL
}

populateMessageSelect();
populateDefaultUrl();

