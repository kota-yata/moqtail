import { STREAM } from "../constants";
import { concatUint8Arrays, getUint8, serializeQuicVarInt, setUint8, deserializeQuicVarInt } from "bytes";

export const serializeSubgroupHeader = (props: SubgroupHeader) => {
  const streamTypeBytes = serializeQuicVarInt(STREAM.SUBGROUP_HEADER);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const groupIdBytes = serializeQuicVarInt(props.groupId);
  const subgroupIdBytes = serializeQuicVarInt(props.subgroupId);
  const publisherPriorityBytes = setUint8(props.publisherPriority);
  return concatUint8Arrays([streamTypeBytes, trackAliasBytes, groupIdBytes, subgroupIdBytes, publisherPriorityBytes]);
}

export const deserializeSubgroupHeader = async (controlReader: ReadableStream): Promise<SubgroupHeader> => {
  const ret: SubgroupHeader = {} as SubgroupHeader;
  ret.trackAlias = await deserializeQuicVarInt(controlReader);
  ret.groupId = await deserializeQuicVarInt(controlReader);
  ret.subgroupId = await deserializeQuicVarInt(controlReader);
  ret.publisherPriority = await getUint8(controlReader);
  return ret;
}

export interface SubgroupHeader {
  trackAlias: number,
  groupId: number,
  subgroupId: number,
  publisherPriority: number,
}
