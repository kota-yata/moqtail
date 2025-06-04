import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";

export const serializeMaxRequestId = (props: { requestId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.MAX_REQUEST_ID);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const length = serializeQuicVarInt(requestIdBytes.byteLength);
  return concatBuffer([messageType, length, requestIdBytes]);
}

export const deserializeMaxRequestId = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  return { requestId };
}
