import { serializeQuicVarInt, concatBuffer, deserializeQuicVarInt, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeUnsubscribe = (subscribeId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE);
  const subscribeIdBytes = serializeQuicVarInt(subscribeId);
  const body = concatBuffer([subscribeIdBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribe = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}

export interface Unsubscribe {
  subscribeId: number;
}
