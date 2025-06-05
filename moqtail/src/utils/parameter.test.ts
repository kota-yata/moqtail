import { serializeParams, deserializeParams, type Parameter } from './parameter';
import { ReadableStream } from 'node:stream/web';
import { CONTROL_MESSAGE } from '../constants';

const streamFromArray = (data: Uint8Array) => {
  return new ReadableStream({
    type: 'bytes',
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
};

describe('utils/parameter', () => {
  test('serialize and deserialize numeric and string params', async () => {
    const params: Parameter[] = [
      { type: 0x02, value: 123 },
      { type: 0x01, value: 'hello' },
    ];
    const bytes = serializeParams(params);
    const result = await deserializeParams(
      CONTROL_MESSAGE.ANNOUNCE,
      streamFromArray(bytes)
    );
    expect(result).toEqual(params);
  });
});
