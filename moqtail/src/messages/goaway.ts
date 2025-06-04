import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, varBytesToString, stringToVarBytes, deserializeQuicVarInt, setUint16, getUint16 } from "../utils/bytes";

export const serializeGoaway = (props: { newSessionUri: string }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.GOAWAY);
  const newSessionUriBytes = stringToVarBytes(props.newSessionUri);
  const length = setUint16(newSessionUriBytes.byteLength);
  return concatBuffer([messageType, length, newSessionUriBytes]);
}

export const deserializeGoaway = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const newSessionUri = await varBytesToString(controlReader);
  return { newSessionUri };
}