import { concatUint8Arrays, getUint8, serializeQuicVarInt, setUint8, deserializeQuicVarInt } from "../utils/bytes";
import { STREAM } from "../constants";

/** Serialize a subgroup header to bytes. */
export const serializeSubgroupHeader = (props: SubgroupHeader) => {
  const streamTypeBytes = serializeQuicVarInt(props.type);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const groupIdBytes = serializeQuicVarInt(props.groupId);
  let subgroupIdBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  if (props.type === STREAM.SUBGROUP_FIELD || props.type === STREAM.SUBGROUP_FIELD_WITH_EXTENSION) {
    if (props.subgroupId === undefined) throw new Error('subgroupId is required for SUBGROUP_FIELD type');
    subgroupIdBytes = serializeQuicVarInt(props.subgroupId);
  }
  const publisherPriorityBytes = setUint8(props.publisherPriority);
  return concatUint8Arrays([streamTypeBytes, trackAliasBytes, groupIdBytes, subgroupIdBytes, publisherPriorityBytes]);
}

/** Deserialize a subgroup header from a stream, given its `STREAM` type. */
export const deserializeSubgroupHeader = async (type: STREAM, controlReader: ReadableStream): Promise<SubgroupHeader> => {
  const ret: SubgroupHeader = {} as SubgroupHeader;
  ret.type = type;
  ret.trackAlias = await deserializeQuicVarInt(controlReader);
  ret.groupId = await deserializeQuicVarInt(controlReader);
  if (ret.type === STREAM.SUBGROUP_FIELD || ret.type === STREAM.SUBGROUP_FIELD_WITH_EXTENSION) {
    ret.subgroupId = await deserializeQuicVarInt(controlReader);
  }
  ret.publisherPriority = await getUint8(controlReader);
  return ret;
}

/** Fields describing a subgroup stream header. */
export interface SubgroupHeader {
  type: STREAM,
  trackAlias: number,
  groupId: number,
  subgroupId: number | undefined,
  publisherPriority: number,
}
