import { deserializeQuicVarInt } from "bytes";

export const readControlMessageType = async (reader: ReadableStream) => {
  return await deserializeQuicVarInt(reader);
}
