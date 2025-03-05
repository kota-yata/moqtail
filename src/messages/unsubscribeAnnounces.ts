import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';

export const serializeUnsubscribeAnnounces = (trackNamespacePrefix: string[]) => {
  const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = numberToVarInt(trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = trackNamespacePrefix.map(stringToVarBytes);
  const body = concatBuffer([trackNamespacePrefixLength, ...trackNamespacePrefixBytes]);
  const length = numberToVarInt(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribeAnnounces = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const trackNamespacePrefixLength = await varIntToNumber(controlReader);
  const trackNamespacePrefix = await Promise.all(Array.from({ length: trackNamespacePrefixLength }, () => varBytesToString(controlReader)));
  return { trackNamespacePrefix };
}
