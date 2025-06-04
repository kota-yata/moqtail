import { serializeQuicVarInt, stringToVarBytes, concatBuffer, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE, ANNOUNCE_ERROR_REASON } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeAnnounceError = (props: { trackNamespace: string[], errorCode: ANNOUNCE_ERROR_REASON, reasonPhrase: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.ANNOUNCE_ERROR);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const errorCodeBytes = serializeQuicVarInt(props.errorCode);
  const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
  const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes, errorCodeBytes, reasonPhraseBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeAnnounceError = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const errorCode = await deserializeQuicVarInt(controlReader) as ANNOUNCE_ERROR_REASON;
  if (!Object.values(ANNOUNCE_ERROR_REASON).includes(errorCode)) {
    throw new Error(`Invalid Announce Error Code: ${errorCode}`);
  }
  const reasonPhrase = await varBytesToString(controlReader);
  return { trackNamespace, errorCode, reasonPhrase };
}
