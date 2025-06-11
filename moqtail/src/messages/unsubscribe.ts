import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeUnsubscribe = (subscribeId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE);
  const subscribeIdBytes = serializeQuicVarInt(subscribeId);
  const body = concatUint8Arrays([subscribeIdBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribe = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}

export interface Unsubscribe {
  subscribeId: number;
}
