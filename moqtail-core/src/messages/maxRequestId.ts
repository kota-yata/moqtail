import { CONTROL_MESSAGE } from "../constants";
import { setUint16, getUint16, concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";

export const serializeMaxRequestId = (props: { requestId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.MAX_REQUEST_ID);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const length = setUint16(requestIdBytes.byteLength);
  return concatUint8Arrays([messageType, length, requestIdBytes]);
};

export const deserializeMaxRequestId = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
};

