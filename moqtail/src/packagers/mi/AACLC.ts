import type { ExtensionHeader } from "../../dataStreams/extensionHeader";
import { concatUint8Arrays, deserializeQuicVarInt, serializeQuicVarInt } from "bytes";
import { MI_EXTENSION_HEADER_TYPE } from "./miExtensionHeaders";

export type AACLCBitstream = {
  seqId: number,
  pts: number,
  timebase: number,
  sampleFreq: number,
  numChannels: number,
  duration: number,
  wallclock: number
};

export const AACLCBitstreamToExtensionHeader = (props: AACLCBitstream): ExtensionHeader => {
  const seqId = serializeQuicVarInt(props.seqId);
  const pts = serializeQuicVarInt(props.pts);
  const timebase = serializeQuicVarInt(props.timebase);
  const sampleFreq = serializeQuicVarInt(props.sampleFreq);
  const numChannels = serializeQuicVarInt(props.numChannels);
  const duration = serializeQuicVarInt(props.duration);
  const wallclock = serializeQuicVarInt(props.wallclock);
  const data = concatUint8Arrays([seqId, pts, timebase, sampleFreq, numChannels, duration, wallclock]);
  return { id: MI_EXTENSION_HEADER_TYPE.AACLC_BITSTREAM, value: data };
}

export const deserializeAACLCBitstream = async (reader: ReadableStream): Promise<AACLCBitstream> => {
  const seqId = await deserializeQuicVarInt(reader);
  const pts = await deserializeQuicVarInt(reader);
  const timebase = await deserializeQuicVarInt(reader);
  const sampleFreq = await deserializeQuicVarInt(reader);
  const numChannels = await deserializeQuicVarInt(reader);
  const duration = await deserializeQuicVarInt(reader);
  const wallclock = await deserializeQuicVarInt(reader);
  return { seqId, pts, timebase, sampleFreq, numChannels, duration, wallclock };
}
