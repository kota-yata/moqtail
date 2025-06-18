import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeTrackStatusRequest = (props: { trackNamespace: string[], trackName: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.TRACK_STATUS_REQUEST);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const body = concatUint8Arrays([trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeTrackStatusRequest = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  return { trackNamespace, trackName };
}
