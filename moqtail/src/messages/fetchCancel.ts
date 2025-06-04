import { serializeQuicVarInt, concatBuffer, deserializeQuicVarInt, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeFetchCancel = (subscribeId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_CANCEL);
  const subscribeIdBytes = serializeQuicVarInt(subscribeId);
  const length = setUint16(subscribeIdBytes.byteLength);
  return concatBuffer([messageTypeBytes, length, subscribeIdBytes]);
}

export const deserializeFetchCancel = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}
