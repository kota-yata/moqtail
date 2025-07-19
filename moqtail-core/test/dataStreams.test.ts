import { serializeExtensionHeader, deserializeExtensionHeader, serializeExtensionHeaders } from '../src/dataStreams/extensionHeader';
import { serializeDatagram, deserializeDatagramHeader } from '../src/dataStreams/datagram';
import { serializeSubgroupHeader, deserializeSubgroupHeader } from '../src/dataStreams/subgroupHeader';
import { serializeSubgroupObject, deserializeSubgroupObjectHeader } from '../src/dataStreams/subgroupObject';
import { STREAM, DATAGRAM, OBJECT_STATUS } from '../src/constants';

const streamFromArray = (arr: Uint8Array) => new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(arr);
    controller.close();
  },
  type: 'bytes'
} as any);

describe('dataStreams', () => {
  test('extensionHeader round trip', async () => {
    const header = { type: 2, value: 5 };
    const serialized = serializeExtensionHeader(header);
    const deserialized = await deserializeExtensionHeader(streamFromArray(serialized));
    expect(deserialized.value).toEqual(header);
    const multi = serializeExtensionHeaders([header]);
    expect(multi.byteLength).toBeGreaterThan(0);
  });

  test('datagram serialize/deserialize', async () => {
    const dg = { trackAlias:1, groupId:2, objectId:3, publisherPriority:4, extensionHeaders:[], payload:new Uint8Array([5]) };
    const serialized = serializeDatagram(dg);
    const header = await deserializeDatagramHeader(streamFromArray(serialized.slice(1)));
    expect(header.trackAlias).toBe(1);
  });

  test('subgroupHeader round trip', async () => {
    const sg = { trackAlias:1, groupId:2, subgroupId:3, publisherPriority:4 };
    const serialized = serializeSubgroupHeader(sg);
    const deserialized = await deserializeSubgroupHeader(streamFromArray(serialized.slice(1)));
    expect(deserialized).toEqual(sg);
  });

  test('subgroupObject round trip', async () => {
    const obj = { objectId:1, extensionHeaders:[], payload:new Uint8Array([1]) };
    const serialized = serializeSubgroupObject(obj);
    const deserialized = await deserializeSubgroupObjectHeader(streamFromArray(serialized.slice(0, serialized.length - obj.payload.length)));
    expect(deserialized.objectId).toBe(1);
  });
});
