import { CONTROL_MESSAGE, GROUP_ORDER, SUBSCRIBE_FILTER } from "../constants";
import { deserializeParams, type Parameter, serializeParams } from "../utils/parameter";
import { concatUint8Arrays, serializeQuicVarInt, stringToVarBytes, deserializeQuicVarInt, varBytesToString, setUint8, getUint8 } from "bytes";
import { deserializeNamespace } from "../utils/namespace";

export const serializeSubscribe = (props: Subscribe) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const namespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const namespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const subscriberPriorityBytes = setUint8(props.subscriberPriority);
  const groupOrderBytes = setUint8(props.groupOrder);
  const filterTypeBytes = serializeQuicVarInt(props.filterType);
  const startGroupBytes = props.startGroup !== undefined ? serializeQuicVarInt(props.startGroup) : new Uint8Array();
  const startObjectBytes = props.startObject !== undefined ? serializeQuicVarInt(props.startObject) : new Uint8Array();
  const endGroupBytes = props.endGroup !== undefined ? serializeQuicVarInt(props.endGroup) : new Uint8Array();
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([subscribeIdBytes, trackAliasBytes, namespaceLength, ...namespaceBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, filterTypeBytes, startGroupBytes, startObjectBytes, endGroupBytes, parametersBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageType, length, body]);
}

export const deserializeSubscribe = async (controlReader: ReadableStream): Promise<Subscribe> => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  const trackAlias = await deserializeQuicVarInt(controlReader);
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  const subscriberPriority = await getUint8(controlReader);
  const groupOrder = await getUint8(controlReader) as GROUP_ORDER;
  if (!Object.values(GROUP_ORDER).includes(groupOrder)) {
    throw new Error(`Invalid Group Order: ${groupOrder}`);
  }
  const filterType = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_FILTER;
  if (!Object.values(SUBSCRIBE_FILTER).includes(filterType)) {
    throw new Error(`Invalid Subscribe Filter Type: ${filterType}`);
  }
  const startGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const startObject = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const endGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE, controlReader);
  return { subscribeId, trackAlias, trackNamespace, trackName, subscriberPriority, groupOrder, filterType, startGroup, startObject, endGroup, parameters };
}

export interface Subscribe {
  subscribeId: number,
  trackAlias: number,
  trackNamespace: string[],
  trackName: string,
  subscriberPriority: number,
  groupOrder: GROUP_ORDER,
  filterType: SUBSCRIBE_FILTER,
  startGroup?: number,
  startObject?: number,
  endGroup?: number,
  parameters?: Parameter[]
}
