import { CONTROL_MESSAGE, GROUP_ORDER, SUBSCRIBE_FILTER, SUBSCRIBE_FORWARD } from "../constants";
import { deserializeParams, type Parameter, serializeParams } from "../utils/parameter";
import { concatUint8Arrays, serializeQuicVarInt, stringToVarBytes, deserializeQuicVarInt, varBytesToString, setUint8, getUint8 } from "bytes";
import { deserializeNamespace, validateFullTrackName } from "../utils/namespace";
import { getUint16, setUint16 } from "bytes";

export const serializeSubscribe = (props: Subscribe) => {
  // Validate track name length
  validateFullTrackName(props.trackNamespace, props.trackName);
  
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const namespaceLength = serializeQuicVarInt(props.trackNamespace.length);
  const namespaceBytes = props.trackNamespace.map(stringToVarBytes);
  const trackNameBytes = stringToVarBytes(props.trackName);
  const subscriberPriorityBytes = setUint8(props.subscriberPriority);
  const groupOrderBytes = setUint8(props.groupOrder);
  const forwardBytes = setUint8(props.forward);
  const filterTypeBytes = serializeQuicVarInt(props.filterType);
  const startGroupBytes = props.startGroup !== undefined ? serializeQuicVarInt(props.startGroup) : new Uint8Array();
  const startObjectBytes = props.startObject !== undefined ? serializeQuicVarInt(props.startObject) : new Uint8Array();
  const endGroupBytes = props.endGroup !== undefined ? serializeQuicVarInt(props.endGroup) : new Uint8Array();
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, trackAliasBytes, namespaceLength, ...namespaceBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, forwardBytes, filterTypeBytes, startGroupBytes, startObjectBytes, endGroupBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageType, length, body]);
}

export const deserializeSubscribe = async (controlReader: ReadableStream): Promise<Subscribe> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const trackAlias = await deserializeQuicVarInt(controlReader);
  const trackNamespace = await deserializeNamespace(controlReader);
  const trackName = await varBytesToString(controlReader);
  const subscriberPriority = await getUint8(controlReader);
  const groupOrder = await getUint8(controlReader) as GROUP_ORDER;
  if (!Object.values(GROUP_ORDER).includes(groupOrder)) {
    throw new Error(`Invalid Group Order: ${groupOrder}`);
  }
  const forward = await getUint8(controlReader) as SUBSCRIBE_FORWARD;
  const filterType = await deserializeQuicVarInt(controlReader) as SUBSCRIBE_FILTER;
  if (!Object.values(SUBSCRIBE_FILTER).includes(filterType)) {
    throw new Error(`Invalid Subscribe Filter Type: ${filterType}`);
  }
  const startGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const startObject = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const endGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await deserializeQuicVarInt(controlReader) : undefined;
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE, controlReader);
  return { requestId, trackAlias, trackNamespace, trackName, subscriberPriority, groupOrder, forward, filterType, startGroup, startObject, endGroup, parameters };
}

export interface Subscribe {
  requestId: number,
  trackAlias: number,
  trackNamespace: string[],
  trackName: string,
  subscriberPriority: number,
  groupOrder: GROUP_ORDER,
  forward: SUBSCRIBE_FORWARD,
  filterType: SUBSCRIBE_FILTER,
  startGroup?: number,
  startObject?: number,
  endGroup?: number,
  parameters?: Parameter[]
}
