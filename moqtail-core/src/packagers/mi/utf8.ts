import { deserializeQuicVarInt, serializeQuicVarInt } from "bytes";

export type utf8Header = {
  seqId: number
}

export const serializeUtf8Header = (props: utf8Header): Uint8Array => {
  const seqId = serializeQuicVarInt(props.seqId);
  return seqId;
}

export const deserializeUtf8Header = async (reader: ReadableStream): Promise<utf8Header> => {
  const seqId = await deserializeQuicVarInt(reader);
  return { seqId };
}
