import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_DONE_REASON } from '../constants';

export const serializeSubscribeDone = (props: { subscribeId: number, statusCode: SUBSCRIBE_DONE_REASON, reasonPhrase: string, streamCount: number }) => {
  const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_DONE);
  const subscribeIdBytes = numberToVarInt(props.subscribeId);
  const statusCodeBytes = numberToVarInt(props.statusCode);
  const streamCountBytes = numberToVarInt(props.streamCount);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatBuffer([subscribeIdBytes, statusCodeBytes, streamCountBytes, reasonPhraseBytes]);
  const length = numberToVarInt(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeSubscribeDone = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const subscribeId = await varIntToNumber(controlReader);
  const statusCode = await varIntToNumber(controlReader) as SUBSCRIBE_DONE_REASON;
  if (!Object.values(SUBSCRIBE_DONE_REASON).includes(statusCode)) {
    throw new Error(`Invalid Subscribe Done Code: ${statusCode}`);
  }
  const streamCount = await varIntToNumber(controlReader);
  const reasonPhrase = await varBytesToString(controlReader);
  return { subscribeId, statusCode, reasonPhrase, streamCount };
}
