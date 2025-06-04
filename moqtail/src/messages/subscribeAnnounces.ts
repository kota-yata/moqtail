import { serializeQuicVarInt, stringToVarBytes, concatBuffer, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { deserializeNamespace } from '../utils/namespace';

export const serializeSubscribeAnnounces = (props: { trackNamespacePrefix: string[], parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES);
  const trackNamespacePrefixLength = serializeQuicVarInt(props.trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatBuffer([trackNamespacePrefixLength, ...trackNamespacePrefixBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnounces = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, controlReader);
  return { trackNamespacePrefix, parameters };
}
