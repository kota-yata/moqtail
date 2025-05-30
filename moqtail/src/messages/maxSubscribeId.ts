import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";

export const serializeMaxSubscribeId = (props: { subscribeId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.MAX_REQUEST_ID);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const length = serializeQuicVarInt(subscribeIdBytes.byteLength);
  return concatBuffer([messageType, length, subscribeIdBytes]);
}

export const deserializeMaxSubscribeId = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}
