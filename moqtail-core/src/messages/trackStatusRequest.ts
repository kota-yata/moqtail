import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace, validateFullTrackName } from '../utils/namespace';
import { getUint16, setUint16 } from '../utils/bytes';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';

export const serializeTrackStatusRequest = (props: { requestId: number, trackNamespace: string[], trackName: string, parameters?: Parameter[] }) => {
  validateFullTrackName(props.trackNamespace, props.trackName);
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.TRACK_STATUS_REQUEST);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeTrackStatusRequest = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.TRACK_STATUS_REQUEST, controlReader);
  return { requestId, trackNamespace, trackName, parameters };
}
