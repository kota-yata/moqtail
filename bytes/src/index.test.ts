import {
  getQuicVarIntLength,
  serializeQuicVarInt,
  deserializeQuicVarIntFromArray,
  concatUint8Arrays,
  buffReadFromArray,
  stringToVarBytes,
  varBytesToStringFromArray,
  setUint8,
  concatBuffer
} from './index';

describe('utils/bytes', () => {
  test('getNumberLength returns correct length', () => {
    expect(getQuicVarIntLength(63)).toBe(1);
    expect(getQuicVarIntLength(16383)).toBe(2);
    expect(getQuicVarIntLength(1073741823)).toBe(4);
    expect(getQuicVarIntLength(Number.MAX_SAFE_INTEGER)).toBe(8);
    expect(() => getQuicVarIntLength(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  test('serializeQuicVarInt serializes correctly', () => {
    expect(serializeQuicVarInt(63)).toEqual(Uint8Array.from([0x3f]));
    expect(serializeQuicVarInt(15293)).toEqual(Uint8Array.from([0x7b, 0xbd]));
    expect(() => serializeQuicVarInt(-1)).toThrow();
  });

  test('deserializeQuicVarIntFromArray deserializes correctly', () => {
    const data = Uint8Array.from([0x7b, 0xbd]);
    const result = deserializeQuicVarIntFromArray(data);
    expect(result.value).toBe(15293);
    expect(result.byteLength).toBe(2);

    const insufficientData = Uint8Array.from([0x40]);
    expect(() => deserializeQuicVarIntFromArray(insufficientData)).toThrow();
  });

  test('concatUint8Arrays concatenates buffers correctly', () => {
    const buf1 = new Uint8Array([1,2]);
    const buf2 = new Uint8Array([3,4]);
    const result = concatUint8Arrays([buf1, buf2]);
    expect(result).toEqual(new Uint8Array([1,2,3,4]));
  });

  test('buffReadFromArray reads correctly', () => {
    const data = new Uint8Array([10,20,30,40]);
    expect(buffReadFromArray(data,2,1)).toEqual(new Uint8Array([20,30]));
    expect(() => buffReadFromArray(data,10,0)).toThrow();
  });

  test('single combination of stringToVarBytes and varBytesToStringFromArray serialize/deserialize correctly', () => {
    const originalStr = 'hello world';
    const serialized = stringToVarBytes(originalStr);
    const deserialized = varBytesToStringFromArray(serialized);
    expect(deserialized.value).toBe(originalStr);
  });

  test('multiple combinations of stringToVarBytes and varBytesToStringFromArray serialize/deserialize correctly', () => {
    const originalStrs = ['hello', 'world', 'foo', 'bar'];
    const serialized = concatBuffer(originalStrs.map(stringToVarBytes));
    const deserialized1 = varBytesToStringFromArray(serialized);
    expect(deserialized1.value).toEqual(originalStrs[0]);
    const deserialized2 = varBytesToStringFromArray(serialized, deserialized1.byteLength);
    expect(deserialized2.value).toEqual(originalStrs[1]);
    const deserialized3 = varBytesToStringFromArray(serialized, deserialized1.byteLength + deserialized2.byteLength);
    expect(deserialized3.value).toEqual(originalStrs[2]);
    const deserialized4 = varBytesToStringFromArray(serialized, deserialized1.byteLength + deserialized2.byteLength + deserialized3.byteLength);
    expect(deserialized4.value).toEqual(originalStrs[3]);
  });

  test('setUint8 creates correct buffer', () => {
    expect(setUint8(255)).toEqual(new Uint8Array([255]));
    expect(setUint8(0)).toEqual(new Uint8Array([0]));
  });
});
