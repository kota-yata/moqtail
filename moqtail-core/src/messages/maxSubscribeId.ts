import { CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";

export const serializeMaxSubscribeId = (props: { subscribeId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.MAX_SUBSCRIBE_ID);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const length = serializeQuicVarInt(subscribeIdBytes.byteLength);
  return concatUint8Arrays([messageType, length, subscribeIdBytes]);
}

export const deserializeMaxSubscribeId = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  return { subscribeId };
}
