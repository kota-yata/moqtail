import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { deserializeNamespace, validateFullTrackName } from '../utils/namespace';
import { getUint16, setUint16 } from 'bytes';

export const serializeAnnounce = (props: Announce) => {
  validateFullTrackName(props.trackNamespace, '');
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.ANNOUNCE);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, trackNamespaceLength, ...trackNamespaceBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeAnnounce = async (controlReader: ReadableStream): Promise<Announce> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const trackNamespace = await deserializeNamespace(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.ANNOUNCE, controlReader);
  return { requestId, trackNamespace, parameters };
}

export interface Announce {
  requestId: number;
  trackNamespace: string[];
  parameters?: Parameter[];
}
