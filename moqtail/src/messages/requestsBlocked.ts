import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";

export const serializeRequestsBlocked = (props: { maxSubscribeId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.REQUESTS_BLOCKED);
  const maxSubscribeIdBytes = serializeQuicVarInt(props.maxSubscribeId);
  const length = serializeQuicVarInt(maxSubscribeIdBytes.byteLength);
  return concatBuffer([messageType, length, maxSubscribeIdBytes]);
}

export const deserializeRequestsBlocked = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const maxSubscribeId = await deserializeQuicVarInt(controlReader);
  return { maxSubscribeId };
}
