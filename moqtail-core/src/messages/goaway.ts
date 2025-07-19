import { CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, varBytesToString, stringToVarBytes, deserializeQuicVarInt } from "bytes";

import { getUint16, setUint16 } from "bytes";
export const serializeGoaway = (props: { newSessionUri: string }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.GOAWAY);
  const newSessionUriBytes = stringToVarBytes(props.newSessionUri);
  const length = setUint16(newSessionUriBytes.byteLength);
  return concatUint8Arrays([messageType, length, newSessionUriBytes]);
}

export const deserializeGoaway = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const newSessionUri = await varBytesToString(controlReader);
  return { newSessionUri };
}