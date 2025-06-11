import { setUint16, getUint16, serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeSubscribeAnnouncesOk = (trackNamespacePrefix: string[]) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_OK);
  const trackNamespacePrefixLength = serializeQuicVarInt(trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = trackNamespacePrefix.map(stringToVarBytes);
  const body = concatUint8Arrays([trackNamespacePrefixLength, ...trackNamespacePrefixBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnouncesOk = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  return { trackNamespacePrefix };
}
