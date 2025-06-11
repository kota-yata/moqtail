import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, FETCH_ERROR_REASON } from '../constants';

export const serializeFetchError = (props: { subscribeId: number, errorCode: FETCH_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_ERROR);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatUint8Arrays([subscribeIdBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeFetchError = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as FETCH_ERROR_REASON;
  if (!Object.values(FETCH_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Fetch Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  return { subscribeId, errorCode, reasonPhrase };
}
