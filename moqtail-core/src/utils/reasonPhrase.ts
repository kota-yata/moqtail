import { serializeQuicVarInt, deserializeQuicVarInt, concatUint8Arrays } from 'bytes';

export interface ReasonPhrase {
  reasonPhrase: string;
}

export const serializeReasonPhrase = (reasonPhrase: string): Uint8Array => {
  const encoder = new TextEncoder();
  const phraseBytes = encoder.encode(reasonPhrase);
  
  if (phraseBytes.length > 1024) {
    throw new Error('Reason phrase exceeds maximum length of 1024 bytes');
  }
  
  const lengthBytes = serializeQuicVarInt(phraseBytes.length);
  return concatUint8Arrays([lengthBytes, phraseBytes]);
};

export const deserializeReasonPhrase = async (reader: ReadableStream): Promise<string> => {
  const length = await deserializeQuicVarInt(reader);
  
  if (length > 1024) {
    throw new Error('Reason phrase length exceeds maximum of 1024 bytes');
  }
  
  if (length === 0) {
    return '';
  }
  
  const phraseBytes = new Uint8Array(length);
  const stream = reader.getReader();
  let offset = 0;
  
  while (offset < length) {
    const { done, value } = await stream.read();
    if (done) {
      throw new Error('Unexpected end of stream while reading reason phrase');
    }
    const bytesToCopy = Math.min(value.length, length - offset);
    phraseBytes.set(value.subarray(0, bytesToCopy), offset);
    offset += bytesToCopy;
  }
  
  stream.releaseLock();
  
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(phraseBytes);
};