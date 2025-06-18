import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, setUint16, getUint16 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeFetchCancel = (subscribeId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_CANCEL);
  const subscribeIdBytes = serializeQuicVarInt(subscribeId);
  const length = setUint16(subscribeIdBytes.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, subscribeIdBytes]);
}

export const deserializeFetchCancel = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}
