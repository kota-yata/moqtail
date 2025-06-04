import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";

export const serializeRequestsBlocked = (props: { maxRequestId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.REQUESTS_BLOCKED);
  const idBytes = serializeQuicVarInt(props.maxRequestId);
  const length = serializeQuicVarInt(idBytes.byteLength);
  return concatBuffer([messageType, length, idBytes]);
}

export const deserializeRequestsBlocked = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const maxRequestId = await deserializeQuicVarInt(controlReader);
  return { maxRequestId };
}
