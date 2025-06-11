import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ERROR_REASON } from '../constants';

export const serializeSubscribeError = (props: SubscribeError) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ERROR);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const body = concatUint8Arrays([subscribeIdBytes, errorCodeBytes, reasonPhraseBytes, trackAliasBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, subscribeIdBytes, errorCodeBytes, reasonPhraseBytes, trackAliasBytes]);
}

export const deserializeSubscribeError = async (controlReader: ReadableStream): Promise<SubscribeError> => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_ERROR_REASON;
  if (!Object.values(SUBSCRIBE_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Subscribe Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  const trackAlias = await deserializeQuicVarInt(controlReader);
  return { subscribeId, errorCode, reasonPhrase, trackAlias };
}

export interface SubscribeError { subscribeId: number, errorCode: SUBSCRIBE_ERROR_REASON, reasonPhrase: string, trackAlias: number };
