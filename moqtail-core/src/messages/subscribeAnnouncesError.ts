import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt } from '../utils/bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ANNOUNCES_ERROR_REASON } from '../constants';
import { getUint16, setUint16 } from "../utils/bytes";
import { serializeReasonPhrase, deserializeReasonPhrase } from '../utils/reasonPhrase';

export interface SubscribeAnnouncesError {
  requestId: number;
  errorCode: SUBSCRIBE_ANNOUNCES_ERROR_REASON;
  reasonPhrase: string;
}

export const serializeSubscribeAnnouncesError = (props: SubscribeAnnouncesError) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = serializeReasonPhrase(props.reasonPhrase);
  const body = concatUint8Arrays([requestIdBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnouncesError = async (controlReader: ReadableStream): Promise<SubscribeAnnouncesError> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_ANNOUNCES_ERROR_REASON;
  if (!Object.values(SUBSCRIBE_ANNOUNCES_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Subscribe Announces Error Code: ${errorCode}`);
  }
  const reasonPhrase = await deserializeReasonPhrase(controlReader);
  return { requestId, errorCode, reasonPhrase };
}
