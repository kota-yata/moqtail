import { CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, varBytesToString, stringToVarBytes, deserializeQuicVarInt } from "bytes";

export const serializeGoaway = (props: { newSessionUri: string }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.GOAWAY);
  const newSessionUriBytes = stringToVarBytes(props.newSessionUri);
  const length = serializeQuicVarInt(newSessionUriBytes.byteLength);
  return concatUint8Arrays([messageType, length, newSessionUriBytes]);
}

export const deserializeGoaway = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const newSessionUri = await varBytesToString(controlReader);
  return { newSessionUri };
}