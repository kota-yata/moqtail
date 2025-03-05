import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, numberToVarInt, varIntToNumber } from "../utils/bytes";

export const serializeSubscribesBlocked = (props: { maxSubscribeId: number }) => {
  const messageType = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBES_BLOCKED);
  const maxSubscribeIdBytes = numberToVarInt(props.maxSubscribeId);
  const length = numberToVarInt(maxSubscribeIdBytes.byteLength);
  return concatBuffer([messageType, length, maxSubscribeIdBytes]);
}

export const deserializeSubscribesBlocked = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const maxSubscribeId = await varIntToNumber(controlReader);
  return { maxSubscribeId };
}
