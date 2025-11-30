import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { getUint16, setUint16 } from '../utils/bytes';

export const serializeAnnounceOk = (props: { requestId: number }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.ANNOUNCE_OK);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const body = requestIdBytes;
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeAnnounceOk = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
}

export interface AnnounceOk {
  requestId: number;
}
