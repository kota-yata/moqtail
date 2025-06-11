import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, ANNOUNCE_ERROR_REASON } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeAnnounceCancel = (props: { trackNamespace: string[], errorCode: ANNOUNCE_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.ANNOUNCE_CANCEL);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatUint8Arrays([trackNamespaceLength, ...trackNamespaceBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeAnnounceCancel = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as ANNOUNCE_ERROR_REASON;
  if (!Object.values(ANNOUNCE_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Announce Cancel Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  return { trackNamespace, errorCode, reasonPhrase };
}
