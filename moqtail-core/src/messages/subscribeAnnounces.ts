import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { getUint16, setUint16 } from "../utils/bytes";
import { deserializeNamespace } from '../utils/namespace';

export const serializeSubscribeAnnounces = (props: { requestId: number, trackNamespacePrefix: string[], parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const trackNamespacePrefixLength = serializeQuicVarInt(props.trackNamespacePrefix.length);
  const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, trackNamespacePrefixLength, ...trackNamespacePrefixBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeAnnounces = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const trackNamespacePrefix = await deserializeNamespace(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, controlReader);
  return { requestId, trackNamespacePrefix, parameters };
}
