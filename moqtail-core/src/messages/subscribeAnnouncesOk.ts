import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { getUint16, setUint16 } from "../utils/bytes";

export interface SubscribeAnnouncesOk {
  requestId: number;
}

export const serializeSubscribeAnnouncesOk = (props: SubscribeAnnouncesOk) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_OK);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const body = requestIdBytes;
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnouncesOk = async (controlReader: ReadableStream): Promise<SubscribeAnnouncesOk> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
}
