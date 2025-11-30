import { CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";
import { getUint16, setUint16 } from "../utils/bytes";

export const serializeRequestsBlocked = (props: { maxRequestId: number }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.REQUESTS_BLOCKED);
  const maxRequestIdBytes = serializeQuicVarInt(props.maxRequestId);
  const length = setUint16(maxRequestIdBytes.byteLength);
  return concatUint8Arrays([messageType, length, maxRequestIdBytes]);
}

export const deserializeRequestsBlocked = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const maxRequestId = await deserializeQuicVarInt(controlReader);
  return { maxRequestId };
}
