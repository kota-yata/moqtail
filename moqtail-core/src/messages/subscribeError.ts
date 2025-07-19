import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ERROR_REASON } from '../constants';
import { getUint16, setUint16 } from 'bytes';

export const serializeSubscribeError = (props: SubscribeError) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ERROR);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const body = concatUint8Arrays([requestIdBytes, errorCodeBytes, reasonPhraseBytes, trackAliasBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeError = async (controlReader: ReadableStream): Promise<SubscribeError> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_ERROR_REASON;
  if (!Object.values(SUBSCRIBE_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Subscribe Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  const trackAlias = await deserializeQuicVarInt(controlReader);
  return { requestId, errorCode, reasonPhrase, trackAlias };
}

export interface SubscribeError { requestId: number, errorCode: SUBSCRIBE_ERROR_REASON, reasonPhrase: string, trackAlias: number };
