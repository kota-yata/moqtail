import { serializeSubscribe, deserializeSubscribe } from '../src/messages/subscribe';
import { serializeUnsubscribe, deserializeUnsubscribe } from '../src/messages/unsubscribe';
import { serializeSubscribeOk, deserializeSubscribeOk } from '../src/messages/subscribeOk';
import { serializeSubscribeError, deserializeSubscribeError } from '../src/messages/subscribeError';
import { serializeSubscribeDone, deserializeSubscribeDone } from '../src/messages/subscribeDone';
import { serializeSubscribeUpdate, deserializeSubscribeUpdate } from '../src/messages/subscribeUpdate';
import { serializeSubscribeAnnounces, deserializeSubscribeAnnounces } from '../src/messages/subscribeAnnounces';
import { serializeSubscribeAnnouncesOk, deserializeSubscribeAnnouncesOk } from '../src/messages/subscribeAnnouncesOk';
import { serializeSubscribeAnnouncesError, deserializeSubscribeAnnouncesError } from '../src/messages/subscribeAnnouncesError';
import { serializeUnsubscribeAnnounces, deserializeUnsubscribeAnnounces } from '../src/messages/unsubscribeAnnounces';
import { GROUP_ORDER, SUBSCRIBE_FILTER, CONTENT_EXISTS, SUBSCRIBE_ERROR_REASON, SUBSCRIBE_DONE_REASON, SUBSCRIBE_ANNOUNCES_ERROR_REASON, CONTROL_MESSAGE } from '../src/constants';
import { serializeQuicVarInt } from 'bytes';

const streamFromArray = (arr: Uint8Array) => new ReadableStream<Uint8Array>({ start(c){ c.enqueue(arr); c.close(); }, type:'bytes' } as any);

describe('control messages subscribe', () => {
  test('serializeSubscribe', () => {
    const msg = { subscribeId:1, trackAlias:0, trackNamespace:['ns'], trackName:'t', subscriberPriority:1, groupOrder:GROUP_ORDER.ASCENDING, filterType:SUBSCRIBE_FILTER.LATEST_OBJECT, parameters:[] };
    const bytes = serializeSubscribe(msg);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeUnsubscribe', () => {
    const bytes = serializeUnsubscribe(1);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeOk', () => {
    const bytes = serializeSubscribeOk({ subscribeId:1, expires:1, groupOrder:GROUP_ORDER.ASCENDING, contentExists:CONTENT_EXISTS.NO, parameters:[] });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeError', () => {
    const bytes = serializeSubscribeError({ subscribeId:1, errorCode:SUBSCRIBE_ERROR_REASON.INTERNAL_ERROR, reasonPhrase:'e', trackAlias:0 });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeDone', () => {
    const bytes = serializeSubscribeDone({ subscribeId:1, statusCode:SUBSCRIBE_DONE_REASON.EXPIRED, reasonPhrase:'r', streamCount:1 });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeUpdate', () => {
    const bytes = serializeSubscribeUpdate({ subscribeId:1, startGroup:1, startObject:1, endGroup:1, subscriberPriority:1, parameters:[] });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeAnnounces', () => {
    const bytes = serializeSubscribeAnnounces({ trackNamespacePrefix:['a'], parameters:[] });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeAnnouncesOk', () => {
    const bytes = serializeSubscribeAnnouncesOk(['a']);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeSubscribeAnnouncesError', () => {
    const bytes = serializeSubscribeAnnouncesError({ trackNamespacePrefix:['a'], errorCode:SUBSCRIBE_ANNOUNCES_ERROR_REASON.INTERNAL_ERROR, reasonPhrase:'x' });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeUnsubscribeAnnounces', () => {
    const bytes = serializeUnsubscribeAnnounces(['a']);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('deserializeSubscribe', async () => {
    const msg = { subscribeId:1, trackAlias:0, trackNamespace:['ns'], trackName:'t', subscriberPriority:1, groupOrder:GROUP_ORDER.ASCENDING, filterType:SUBSCRIBE_FILTER.LATEST_OBJECT, parameters:[] };
    const bytes = serializeSubscribe(msg);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribe(stream)).resolves.toEqual({ ...msg, startGroup: undefined, startObject: undefined, endGroup: undefined });
  });

  test('deserializeUnsubscribe', async () => {
    const bytes = serializeUnsubscribe(1);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeUnsubscribe(stream)).resolves.toEqual({ subscribeId:1 });
  });

  test('deserializeSubscribeOk', async () => {
    const props = { subscribeId:1, expires:1, groupOrder:GROUP_ORDER.ASCENDING, contentExists:CONTENT_EXISTS.NO, parameters:[] };
    const bytes = serializeSubscribeOk(props);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_OK).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeOk(stream)).resolves.toEqual({ ...props, largestGroupId: undefined, largestObjectId: undefined });
  });

  test('deserializeSubscribeError', async () => {
    const props = { subscribeId:1, errorCode:SUBSCRIBE_ERROR_REASON.INTERNAL_ERROR, reasonPhrase:'e', trackAlias:0 };
    const bytes = serializeSubscribeError(props);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ERROR).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeError(stream)).resolves.toEqual(props);
  });

  test('deserializeSubscribeDone', async () => {
    const props = { subscribeId:1, statusCode:SUBSCRIBE_DONE_REASON.EXPIRED, reasonPhrase:'r', streamCount:1 };
    const bytes = serializeSubscribeDone(props);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_DONE).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeDone(stream)).resolves.toEqual(props);
  });

  test('deserializeSubscribeUpdate', async () => {
    const props = { subscribeId:1, startGroup:1, startObject:1, endGroup:1, subscriberPriority:1, parameters:[] };
    const bytes = serializeSubscribeUpdate(props);
    const typeLen = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_UPDATE).byteLength;
    const lenLen = 2; // body length
    const stream = streamFromArray(bytes.slice(typeLen + lenLen));
    await expect(deserializeSubscribeUpdate(stream)).resolves.toEqual(props);
  });

  test('deserializeSubscribeAnnounces', async () => {
    const props = { trackNamespacePrefix:['a'], parameters:[] };
    const bytes = serializeSubscribeAnnounces(props);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeAnnounces(stream)).resolves.toEqual(props);
  });

  test('deserializeSubscribeAnnouncesOk', async () => {
    const bytes = serializeSubscribeAnnouncesOk(['a']);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_OK).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeAnnouncesOk(stream)).resolves.toEqual({ trackNamespacePrefix:['a'] });
  });

  test('deserializeSubscribeAnnouncesError', async () => {
    const props = { trackNamespacePrefix:['a'], errorCode:SUBSCRIBE_ANNOUNCES_ERROR_REASON.INTERNAL_ERROR, reasonPhrase:'x' };
    const bytes = serializeSubscribeAnnouncesError(props);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeSubscribeAnnouncesError(stream)).resolves.toEqual(props);
  });

  test('deserializeUnsubscribeAnnounces', async () => {
    const bytes = serializeUnsubscribeAnnounces(['a']);
    const off = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeUnsubscribeAnnounces(stream)).resolves.toEqual({ trackNamespacePrefix:['a'] });
  });
});
