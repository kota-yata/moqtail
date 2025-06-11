import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeTrackStatusRequest = (props: { trackNamespace: string[], trackName: string }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.TRACK_STATUS_REQUEST);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const body = concatUint8Arrays([trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeTrackStatusRequest = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  return { trackNamespace, trackName };
}
