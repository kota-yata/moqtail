import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { deserializeNamespace } from '../utils/namespace';

export const serializeAnnounce = (props: Announce) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.ANNOUNCE);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([trackNamespaceLength, ...trackNamespaceBytes, parametersBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeAnnounce = async (controlReader: ReadableStream): Promise<Announce> => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.ANNOUNCE, controlReader);
  return { trackNamespace, parameters };
}

export interface Announce {
  trackNamespace: string[];
  parameters?: Parameter[];
}
