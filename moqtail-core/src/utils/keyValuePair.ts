import { serializeQuicVarInt, deserializeQuicVarInt, concatUint8Arrays, buffRead } from 'bytes';

/**
 * Low-level Key-Value-Pair encoding used by several MOQT structures.
 * Even types store a varint number; odd types store length-prefixed bytes.
 */
export interface KeyValuePair {
  type: number;
  value: number | Uint8Array;
}

/** Serialize a single Key-Value-Pair. */
export const serializeKeyValuePair = (pair: KeyValuePair): Uint8Array => {
  const typeBytes = serializeQuicVarInt(pair.type);
  
  if (pair.type % 2 === 0) {
    // Even type: value is a varint
    if (typeof pair.value !== 'number') {
      throw new Error('Even type requires number value');
    }
    const valueBytes = serializeQuicVarInt(pair.value);
    return concatUint8Arrays([typeBytes, valueBytes]);
  } else {
    // Odd type: value is a byte array with length prefix
    if (!(pair.value instanceof Uint8Array)) {
      throw new Error('Odd type requires Uint8Array value');
    }
    if (pair.value.length > 65535) {
      throw new Error('Value length exceeds maximum of 65535 bytes');
    }
    const lengthBytes = serializeQuicVarInt(pair.value.length);
    return concatUint8Arrays([typeBytes, lengthBytes, pair.value]);
  }
};

/** Deserialize a single Key-Value-Pair from a stream. */
export const deserializeKeyValuePair = async (reader: ReadableStream): Promise<KeyValuePair> => {
  const type = await deserializeQuicVarInt(reader);
  
  if (type % 2 === 0) {
    // Even type: value is a varint
    const value = await deserializeQuicVarInt(reader);
    return { type, value };
  } else {
    // Odd type: value is a byte array with length prefix
    const length = await deserializeQuicVarInt(reader);
    if (length > 65535) {
      throw new Error('Value length exceeds maximum of 65535 bytes');
    }
    
    // Use the existing buffRead function to read the bytes
    const valueBytes = await buffRead(reader, length);
    return { type, value: valueBytes };
  }
};
