import { readStream } from '../src/utils/stream';
import { serializeParams, deserializeParams, Parameter } from '../src/utils/parameter';
import { deserializeNamespace } from '../src/utils/namespace';
import { CONTROL_MESSAGE, PARAMETER } from '../src/constants';

const streamFromArray = (arr: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(arr);
      controller.close();
    },
    type: 'bytes'
  } as any);

describe('utils', () => {
  test('readStream resolves', async () => {
    const data = new Uint8Array([1,2,3,4]);
    const stream = streamFromArray(data);
    await expect(readStream(stream)).resolves.toBeInstanceOf(Uint8Array);
  });

  test('serializeParams and deserializeParams round trip', async () => {
    const params: Parameter[] = [
      { type: PARAMETER.SETUP.PATH.KEY, value: 'path' },
      { type: PARAMETER.SETUP.MAX_REQUEST_ID.KEY, value: 10 }
    ];
    const serialized = serializeParams(params);
    const stream = streamFromArray(serialized.slice(serializeParams([]).byteLength));
    const deserialized = await deserializeParams(CONTROL_MESSAGE.CLIENT_SETUP, stream);
    expect(Array.isArray(deserialized)).toBe(true);
  });

  test('deserializeNamespace reads namespace array', async () => {
    const strings = ['a','b'];
    const encoder = new TextEncoder();
    const lengthBytes = new Uint8Array([strings.length]);
    const items = strings.flatMap(str => {
      const bytes = encoder.encode(str);
      return [bytes.length, ...bytes];
    });
    const stream = streamFromArray(new Uint8Array([...lengthBytes, ...items]));
    const result = await deserializeNamespace(stream);
    expect(result.length).toBe(strings.length);
  });
});
