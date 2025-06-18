import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, setUint16, getUint16 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeUnsubscribe = (subscribeId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE);
  const subscribeIdBytes = serializeQuicVarInt(subscribeId);
  const body = concatUint8Arrays([subscribeIdBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribe = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}

export interface Unsubscribe {
  subscribeId: number;
}
