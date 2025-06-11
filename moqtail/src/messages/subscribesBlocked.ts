import { CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";

export const serializeSubscribesBlocked = (props: { maxSubscribeId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBES_BLOCKED);
  const maxSubscribeIdBytes = serializeQuicVarInt(props.maxSubscribeId);
  const length = serializeQuicVarInt(maxSubscribeIdBytes.byteLength);
  return concatUint8Arrays([messageType, length, maxSubscribeIdBytes]);
}

export const deserializeSubscribesBlocked = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const maxSubscribeId = await deserializeQuicVarInt(controlReader);
  return { maxSubscribeId };
}
