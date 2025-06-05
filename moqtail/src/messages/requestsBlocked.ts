import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt, setUint16, getUint16 } from "../utils/bytes";

export const serializeRequestsBlocked = (props: { maxRequestId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.REQUESTS_BLOCKED);
  const idBytes = serializeQuicVarInt(props.maxRequestId);
  const length = setUint16(idBytes.byteLength);
  return concatBuffer([messageType, length, idBytes]);
}

export const deserializeRequestsBlocked = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const maxRequestId = await deserializeQuicVarInt(controlReader);
  return { maxRequestId };
}
