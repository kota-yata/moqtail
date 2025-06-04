import { serializeQuicVarInt, stringToVarBytes, concatBuffer, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeUnsubscribeAnnounces = (trackNamespacePrefix: string[]) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = serializeQuicVarInt(trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = trackNamespacePrefix.map(stringToVarBytes);
  const body = concatBuffer([trackNamespacePrefixLength, ...trackNamespacePrefixBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribeAnnounces = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  return { trackNamespacePrefix };
}
