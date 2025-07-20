import { concatUint8Arrays, getUint8, serializeQuicVarInt, setUint8, deserializeQuicVarInt } from "bytes";

export const serializeSubgroupHeader = (props: SubgroupHeader) => {
  const streamTypeBytes = serializeQuicVarInt(props.type);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const groupIdBytes = serializeQuicVarInt(props.groupId);
  let subgroupIdBytes = new Uint8Array(0);
  if (props.type === SUBGROUP_HEADER_TYPE.SUBGROUP_FIELD || props.type === SUBGROUP_HEADER_TYPE.SUBGROUP_FIELD_WITH_EXTENSION) {
    if (props.subgroupId === undefined) throw new Error('subgroupId is required for SUBGROUP_FIELD type');
    subgroupIdBytes = serializeQuicVarInt(props.subgroupId);
  }
  const publisherPriorityBytes = setUint8(props.publisherPriority);
  return concatUint8Arrays([streamTypeBytes, trackAliasBytes, groupIdBytes, subgroupIdBytes, publisherPriorityBytes]);
}

export const deserializeSubgroupHeader = async (controlReader: ReadableStream): Promise<SubgroupHeader> => {
  const ret: SubgroupHeader = {} as SubgroupHeader;
  ret.type = await deserializeQuicVarInt(controlReader) as SUBGROUP_HEADER_TYPE;
  ret.trackAlias = await deserializeQuicVarInt(controlReader);
  ret.groupId = await deserializeQuicVarInt(controlReader);
  if (ret.type === SUBGROUP_HEADER_TYPE.SUBGROUP_FIELD || ret.type === SUBGROUP_HEADER_TYPE.SUBGROUP_FIELD_WITH_EXTENSION) {
    ret.subgroupId = await deserializeQuicVarInt(controlReader);
  }
  ret.publisherPriority = await getUint8(controlReader);
  return ret;
}

export const SUBGROUP_HEADER_TYPE = {
  NO_SUBGROUP_FIELD: 0x8,
  NO_SUBGROUP_FIELD_WITH_EXTENSION: 0x9,
  NO_SUBGROUP_FIELD_WITH_SUBGROUP_ID: 0xA,
  NO_SUBGROUP_FIELD_WITH_SUBGROUP_ID_AND_EXTENSION: 0xB,
  SUBGROUP_FIELD: 0xC,
  SUBGROUP_FIELD_WITH_EXTENSION: 0xD,
} as const;
export type SUBGROUP_HEADER_TYPE = ObjectValueList<typeof SUBGROUP_HEADER_TYPE>;

export interface SubgroupHeader {
  type: SUBGROUP_HEADER_TYPE,
  trackAlias: number,
  groupId: number,
  subgroupId: number | undefined,
  publisherPriority: number,
}
