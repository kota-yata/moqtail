import { serializeQuicVarInt, stringToVarBytes, concatBuffer, deserializeQuicVarInt, varBytesToString, setUint16, getUint16 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeNamespace } from '../utils/namespace';

export const serializeUnannounce = (props: { trackNamespace: string[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.UNANNOUNCE);
  const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes]);
  const length = setUint16(body.byteLength);
  return concatBuffer([messageTypeBytes, length, body]);
}

export const deserializeUnannounce = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const trackNamespace = await deserializeNamespace(controlReader);
  return { trackNamespace };
}

export interface Unannounce {
  trackNamespace: string[];
}
