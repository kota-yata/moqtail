import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from 'bytes';
import { CONTROL_MESSAGE, FETCH_ERROR_REASON } from '../constants';
import { getUint16, setUint16 } from 'bytes';
import { deserializeReasonPhrase, serializeReasonPhrase } from '../utils/reasonPhrase';

export const serializeFetchError = (props: { requestId: number, errorCode: FETCH_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_ERROR);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = serializeReasonPhrase(props.reasonPhrase);
  const body = concatUint8Arrays([requestIdBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeFetchError = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as FETCH_ERROR_REASON;
  if (!Object.values(FETCH_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Fetch Error Code: ${errorCode}`);
  }
  const reasonPhrase = await deserializeReasonPhrase(controlReader);
  return { requestId, errorCode, reasonPhrase };
}
