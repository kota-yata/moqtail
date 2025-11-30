import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { getUint16, setUint16 } from '../utils/bytes';

export const serializeFetchCancel = (requestId: number) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_CANCEL);
  const requestIdBytes = serializeQuicVarInt(requestId);
  const length = setUint16(requestIdBytes.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, requestIdBytes]);
}

export const deserializeFetchCancel = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
}
