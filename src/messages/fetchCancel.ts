import { numberToVarInt, concatBuffer, varIntToNumber } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeFetchCancel = (subscribeId: number) => {
  const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.FETCH_CANCEL);
  const subscribeIdBytes = numberToVarInt(subscribeId);
  const length = numberToVarInt(subscribeIdBytes.byteLength);
  return concatBuffer([messageTypeBytes, length, subscribeIdBytes]);
}

export const deserializeFetchCancel = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const subscribeId = await varIntToNumber(controlReader);
  return { subscribeId };
}
