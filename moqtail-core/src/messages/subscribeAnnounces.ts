import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { deserializeNamespace } from '../utils/namespace';

export const serializeSubscribeAnnounces = (props: { trackNamespacePrefix: string[], parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = serializeQuicVarInt(props.trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([trackNamespacePrefixLength, ...trackNamespacePrefixBytes, parametersBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnounces = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, controlReader);
  return { trackNamespacePrefix, parameters };
}
