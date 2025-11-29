import { concatUint8Arrays, serializeQuicVarInt, getQuicVarIntLength } from "bytes";
import { KeyValuePair, serializeKeyValuePair, deserializeKeyValuePair } from "../utils/keyValuePair";

/**
 * Stream extension header. Even `type` values hold a varint `value`.
 * Odd `type` values hold a byte array value.
 */
export interface ExtensionHeader {
  type: number;
  value: number | Uint8Array;
}

/** Serialize a single `ExtensionHeader`. */
export const serializeExtensionHeader = (props: ExtensionHeader) => {
  if (!props) return new Uint8Array(0);
  if (props.type === 0) throw new Error('Extension header type 0 is not allowed');
  
  const keyValuePair: KeyValuePair = {
    type: props.type,
    value: props.value
  };
  
  return serializeKeyValuePair(keyValuePair);
}

/**
 * Deserialize a single `ExtensionHeader` and report its byte length.
 */
export const deserializeExtensionHeader = async (reader: ReadableStream): Promise<{ value: ExtensionHeader, byteLength: number }> => {
  const keyValuePair = await deserializeKeyValuePair(reader);
  
  let byteLength = getQuicVarIntLength(keyValuePair.type);
  
  if (keyValuePair.type % 2 === 0) {
    // Even type: value is a varint
    byteLength += getQuicVarIntLength(keyValuePair.value as number);
  } else {
    // Odd type: value is a byte array with length prefix
    const valueBytes = keyValuePair.value as Uint8Array;
    byteLength += getQuicVarIntLength(valueBytes.length) + valueBytes.length;
  }
  
  return {
    value: {
      type: keyValuePair.type,
      value: keyValuePair.value
    },
    byteLength
  };
}

/** Serialize a list of `ExtensionHeader`s with a total length prefix. */
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
