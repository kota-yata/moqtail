import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';
import { getUint16, setUint16 } from "../utils/bytes";

export const serializeUnsubscribeAnnounces = (trackNamespacePrefix: string[]) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = serializeQuicVarInt(trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = trackNamespacePrefix.map(stringToVarBytes);
  const body = concatUint8Arrays([trackNamespacePrefixLength, ...trackNamespacePrefixBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribeAnnounces = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  return { trackNamespacePrefix };
}
