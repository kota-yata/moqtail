import { buffRead, concatUint8Arrays, serializeQuicVarInt, stringToVarBytes, deserializeQuicVarInt, getQuicVarIntLength } from "bytes";

export interface ExtensionHeader {
  id: number;
  value: number | string | Uint8Array;
}

export const serializeExtensionHeader = (props: ExtensionHeader) => {
  if (!props) return new Uint8Array(0);
  if (props.id === 0) throw new Error('Extension header type 0 is not allowed');
  const typeBytes = serializeQuicVarInt(props.id);
  let valueBytes: Uint8Array;
  if (props.id % 2 === 0) {
    valueBytes = serializeQuicVarInt(props.value as number);
  } else if (typeof props.value === 'object') {
    valueBytes = concatUint8Arrays([serializeQuicVarInt(props.value.byteLength), props.value]);
  } else {
    valueBytes = stringToVarBytes(props.value as string);
  }
  return concatUint8Arrays([typeBytes, valueBytes]);
}

export const deserializeExtensionHeader = async (reader: ReadableStream): Promise<{ value: ExtensionHeader, byteLength: number }> => {
  const id = await deserializeQuicVarInt(reader);
  let byteLength = getQuicVarIntLength(id);
  let value: string | number | Uint8Array;
  if (id % 2 === 0) {
    value = await deserializeQuicVarInt(reader);
    byteLength += getQuicVarIntLength(value);
  } else {
    const len = await deserializeQuicVarInt(reader);
    value = await buffRead(reader, len);
    byteLength += getQuicVarIntLength(len) + len;
  }
  return { value: { id, value }, byteLength};
}

export const serializeExtensionHeaders = (headers: ExtensionHeader[]): Uint8Array => {
  let totalLength = 0;
  const serializedHeaders = headers.map(header => {
    const serialized = serializeExtensionHeader(header);
    totalLength += serialized.byteLength;
    return serialized;
  });
  const headersLengthBytes = serializeQuicVarInt(totalLength);
  return concatUint8Arrays([headersLengthBytes, ...serializedHeaders]);
}
