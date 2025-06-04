import { serializeQuicVarInt, stringToVarBytes, concatBuffer, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE, TRACK_STATUS_CODE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeTrackStatus = (props: { trackNamespace: string[], trackName: string, statusCode: TRACK_STATUS_CODE, lastGroupId: number, lastObjectId: number }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.TRACK_STATUS);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const statusCodeBytes = serializeQuicVarInt(props.statusCode);
  const lastGroupIdBytes = serializeQuicVarInt(props.lastGroupId);
  const lastObjectIdBytes = serializeQuicVarInt(props.lastObjectId);
  const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes, statusCodeBytes, lastGroupIdBytes, lastObjectIdBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeTrackStatus = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  const statusCode = await deserializeQuicVarInt(controlReader) as TRACK_STATUS_CODE;
  if (!Object.values(TRACK_STATUS_CODE).includes(statusCode)) {
    throw new Error(`Invalid Track Status Code: ${statusCode}`);
  }
  const lastGroupId = await deserializeQuicVarInt(controlReader);
  const lastObjectId = await deserializeQuicVarInt(controlReader);
  return { trackNamespace, trackName, statusCode, lastGroupId, lastObjectId };
}
