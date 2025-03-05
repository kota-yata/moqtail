import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeAnnounceOk = (props: { trackNamespace: string[] }) => {
  const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.ANNOUNCE_OK);
  const trackNamespaceLength = numberToVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes]);
  const length = numberToVarInt(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeAnnounceOk = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const trackNamespaceLength = await varIntToNumber(controlReader);
  const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
  return { trackNamespace };
}
