import { serializeClientSetup, deserializeClientSetup } from '../src/messages/clientSetup';
import { serializeServerSetup, deserializeServerSetup } from '../src/messages/serverSetup';
import { serializeGoaway, deserializeGoaway } from '../src/messages/goaway';
import { serializeMaxRequestId, deserializeMaxRequestId } from '../src/messages/maxRequestId';
import { serializeRequestsBlocked, deserializeRequestsBlocked } from '../src/messages/requestsBlocked';
import { MOQT_DRAFT11_VERSION, CONTROL_MESSAGE } from '../src/constants';
import { serializeQuicVarInt } from 'bytes';

const streamFromArray = (arr: Uint8Array) =>
  new ReadableStream<Uint8Array>({ start(c){ c.enqueue(arr); c.close(); }, type:'bytes' } as any);

describe('control messages setup', () => {
  test('serializeClientSetup', () => {
    const bytes = serializeClientSetup({ supportedVersions: [MOQT_DRAFT11_VERSION] });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeServerSetup', () => {
    const bytes = serializeServerSetup({ selectedVersion: MOQT_DRAFT11_VERSION, parameters: [] });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeGoaway', () => {
    const bytes = serializeGoaway({ newSessionUri: 'uri' });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeMaxRequestId', () => {
    const bytes = serializeMaxRequestId({ requestId: 1 });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('serializeRequestsBlocked', () => {
    const bytes = serializeRequestsBlocked({ maxRequestId: 1 });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test('deserializeClientSetup', async () => {
    const bytes = serializeClientSetup({ supportedVersions: [MOQT_DRAFT11_VERSION] });
    const off = serializeQuicVarInt(CONTROL_MESSAGE.CLIENT_SETUP).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeClientSetup(stream)).resolves.toEqual({ versions: [MOQT_DRAFT11_VERSION], parameters: [] });
  });

  test('deserializeServerSetup', async () => {
    const bytes = serializeServerSetup({ selectedVersion: MOQT_DRAFT11_VERSION, parameters: [] });
    const off = serializeQuicVarInt(CONTROL_MESSAGE.SERVER_SETUP).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeServerSetup(stream)).resolves.toEqual({ selectedVersion: MOQT_DRAFT11_VERSION, parameters: [] });
  });

  test('deserializeGoaway', async () => {
    const bytes = serializeGoaway({ newSessionUri: 'uri' });
    const off = serializeQuicVarInt(CONTROL_MESSAGE.GOAWAY).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeGoaway(stream)).resolves.toEqual({ newSessionUri: 'uri' });
  });

  test('deserializeMaxRequestId', async () => {
    const bytes = serializeMaxRequestId({ requestId: 1 });
    const off = serializeQuicVarInt(CONTROL_MESSAGE.MAX_REQUEST_ID).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeMaxRequestId(stream)).resolves.toEqual({ requestId: 1 });
  });

  test('deserializeRequestsBlocked', async () => {
    const bytes = serializeRequestsBlocked({ maxRequestId: 1 });
    const off = serializeQuicVarInt(CONTROL_MESSAGE.REQUESTS_BLOCKED).byteLength;
    const stream = streamFromArray(bytes.slice(off));
    await expect(deserializeRequestsBlocked(stream)).resolves.toEqual({ maxRequestId: 1 });
  });
});
