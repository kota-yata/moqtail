import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString, setUint8 } from 'bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_DONE_REASON } from '../constants';

export const serializeSubscribeDone = (props: { subscribeId: number, statusCode: SUBSCRIBE_DONE_REASON, reasonPhrase: string, streamCount: number }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_DONE);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const statusCodeBytes = serializeQuicVarInt(props.statusCode);
  const streamCountBytes = serializeQuicVarInt(props.streamCount);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const contentExists = setUint8(0);
  const body = concatUint8Arrays([subscribeIdBytes, statusCodeBytes, streamCountBytes, reasonPhraseBytes, contentExists]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeDone = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  const statusCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_DONE_REASON;
  if (!Object.values(SUBSCRIBE_DONE_REASON).includes(statusCode)) {
    throw new Error(`Invalid Subscribe Done Code: ${statusCode}`);
  }
  const streamCount = await deserializeQuicVarInt(controlReader);
  const reasonPhrase = await varBytesToString(controlReader);
  return { subscribeId, statusCode, reasonPhrase, streamCount };
}
