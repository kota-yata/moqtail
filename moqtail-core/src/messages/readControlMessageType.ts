import { deserializeQuicVarInt } from "../utils/bytes";

export const readControlMessageType = async (reader: ReadableStream) => {
  return await deserializeQuicVarInt(reader);
}
