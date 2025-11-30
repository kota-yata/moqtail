import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString, setUint8 } from '../utils/bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_DONE_REASON } from '../constants';
import { getUint16, setUint16 } from '../utils/bytes';
import { deserializeReasonPhrase, serializeReasonPhrase } from '../utils/reasonPhrase';

export const serializeSubscribeDone = (props: SubscribeDone) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_DONE);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const statusCodeBytes = serializeQuicVarInt(props.statusCode);
  const streamCountBytes = serializeQuicVarInt(props.streamCount);
  const reasonPhraseBytes = serializeReasonPhrase(props.reasonPhrase);
  const body = concatUint8Arrays([requestIdBytes, statusCodeBytes, streamCountBytes, reasonPhraseBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeDone = async (controlReader: ReadableStream): Promise<SubscribeDone> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const statusCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_DONE_REASON;
  if (!Object.values(SUBSCRIBE_DONE_REASON).includes(statusCode)) {
    throw new Error(`Invalid Subscribe Done Code: ${statusCode}`);
  }
  const streamCount = await deserializeQuicVarInt(controlReader);
  const reasonPhrase = await deserializeReasonPhrase(controlReader);
  return { requestId, statusCode, reasonPhrase, streamCount };
}

export interface SubscribeDone {
  requestId: number,
  statusCode: SUBSCRIBE_DONE_REASON,
  reasonPhrase: string,
  streamCount: number
}
