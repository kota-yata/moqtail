import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeUnsubscribeAnnounces = (trackNamespacePrefix: string[]) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNSUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = serializeQuicVarInt(trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = trackNamespacePrefix.map(stringToVarBytes);
  const body = concatUint8Arrays([trackNamespacePrefixLength, ...trackNamespacePrefixBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeUnsubscribeAnnounces = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  return { trackNamespacePrefix };
}
