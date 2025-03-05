import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, numberToVarInt, varBytesToString, stringToVarBytes, varIntToNumber } from "../utils/bytes";

export const serializeGoaway = (props: { newSessionUri: string }) => {
  const messageType = numberToVarInt(CONTROL_MESSAGE.GOAWAY);
  const newSessionUriBytes = stringToVarBytes(props.newSessionUri);
  const length = numberToVarInt(newSessionUriBytes.byteLength);
  return concatBuffer([messageType, length, newSessionUriBytes]);
}

export const deserializeGoaway = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const newSessionUri = await varBytesToString(controlReader);
  return { newSessionUri };
}