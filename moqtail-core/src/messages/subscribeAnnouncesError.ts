import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ANNOUNCES_ERROR_REASON } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeSubscribeAnnouncesError = (props: { trackNamespacePrefix: string[], errorCode: SUBSCRIBE_ANNOUNCES_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR);
  const trackNamespacePrefixLength = serializeQuicVarInt(props.trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatUint8Arrays([trackNamespacePrefixLength, ...trackNamespacePrefixBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnouncesError = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_ANNOUNCES_ERROR_REASON;
  if (!Object.values(SUBSCRIBE_ANNOUNCES_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Subscribe Announces Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  return { trackNamespacePrefix, errorCode, reasonPhrase };
}
