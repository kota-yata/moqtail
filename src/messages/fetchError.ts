import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, FETCH_ERROR_REASON } from '../constants';

export const serializeFetchError = (props: { subscribeId: number, errorCode: FETCH_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.FETCH_ERROR);
  const subscribeIdBytes = numberToVarInt(props.subscribeId);
  const errorCodeBytes = numberToVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatBuffer([subscribeIdBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = numberToVarInt(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeFetchError = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const subscribeId = await varIntToNumber(controlReader);
  const errorCode = await varIntToNumber(controlReader) as FETCH_ERROR_REASON;
  if (!Object.values(FETCH_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Fetch Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  return { subscribeId, errorCode, reasonPhrase };
}
