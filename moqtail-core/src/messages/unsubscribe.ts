import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { getUint16, setUint16 } from 'bytes';

export const serializeUnsubscribe = (requestId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE);
  const requestIdBytes = serializeQuicVarInt(requestId);
  const body = concatUint8Arrays([requestIdBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribe = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
}

export interface Unsubscribe {
  requestId: number;
}
