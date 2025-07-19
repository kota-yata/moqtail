import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, stringToVarBytes, varBytesToString, setUint8, getUint8 } from 'bytes';
import { CONTROL_MESSAGE, FETCH_TYPE } from '../constants';
import { deserializeParams, type Parameter, serializeParams } from '../utils/parameter';
import { deserializeNamespace, validateFullTrackName } from '../utils/namespace';
import { getUint16, setUint16 } from 'bytes';

export const serializeFetch = (props: { requestId: number, subscriberPriority: number, groupOrder: number, fetchType: FETCH_TYPE, trackNamespace?: string[], trackName?: string, startGroup?: number, startObject?: number, endGroup?: number, endObject?: number, joiningRequestId?: number, precedingGroupOffset?: number, parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const subscriberPriorityBytes = setUint8(props.subscriberPriority);
  const groupOrderBytes = setUint8(props.groupOrder);
  const fetchTypeBytes = serializeQuicVarInt(props.fetchType);
  let body: Uint8Array;

  if (props.fetchType === FETCH_TYPE.STANDALONE) {
    if (!props.trackNamespace || !props.trackName || !props.startGroup || !props.startObject || !props.endGroup || !props.endObject) {
      throw new Error('Invalid Fetch props for Standalone');
    }
    validateFullTrackName(props.trackNamespace, props.trackName);
    const trackNamespaceLength = serializeQuicVarInt(props.trackNamespace!.length);
    const trackNamespaceBytes = props.trackNamespace!.map(stringToVarBytes);
    const trackNameBytes = stringToVarBytes(props.trackName!);
    const startGroupBytes = serializeQuicVarInt(props.startGroup!);
    const startObjectBytes = serializeQuicVarInt(props.startObject!);
    const endGroupBytes = serializeQuicVarInt(props.endGroup!);
    const endObjectBytes = serializeQuicVarInt(props.endObject!);
    const parametersBytes = serializeParams(props.parameters || []);
    body = concatUint8Arrays([requestIdBytes, subscriberPriorityBytes, groupOrderBytes, fetchTypeBytes, trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes, startGroupBytes, startObjectBytes, endGroupBytes, endObjectBytes, parametersBytes]);
  } else {
    if (!props.joiningRequestId || !props.precedingGroupOffset) {
      throw new Error('Invalid Fetch props for Joining');
    }
    const joiningRequestIdBytes = serializeQuicVarInt(props.joiningRequestId!);
    const precedingGroupOffsetBytes = serializeQuicVarInt(props.precedingGroupOffset!);
    const parametersBytes = serializeParams(props.parameters || []);
    body = concatUint8Arrays([requestIdBytes, subscriberPriorityBytes, groupOrderBytes, fetchTypeBytes, joiningRequestIdBytes, precedingGroupOffsetBytes, parametersBytes]);
  }

  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeFetch = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const subscriberPriority = await getUint8(controlReader);
  const groupOrder = await getUint8(controlReader);
  const fetchType = await deserializeQuicVarInt(controlReader) as FETCH_TYPE;

  if (fetchType !== FETCH_TYPE.STANDALONE && fetchType !== FETCH_TYPE.JOINING) {
    throw new Error(`Invalid Fetch Type: ${fetchType}`);
  }

  let result: any = { requestId, subscriberPriority, groupOrder, fetchType };

  if (fetchType === FETCH_TYPE.STANDALONE) {
    const trackNamespace = await deserializeNamespace(controlReader);
    const trackName = await varBytesToString(controlReader);
    const startGroup = await deserializeQuicVarInt(controlReader);
    const startObject = await deserializeQuicVarInt(controlReader);
    const endGroup = await deserializeQuicVarInt(controlReader);
    const endObject = await deserializeQuicVarInt(controlReader);
    const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH, controlReader);
    result = { ...result, trackNamespace, trackName, startGroup, startObject, endGroup, endObject, parameters };
  } else {
    const joiningRequestId = await deserializeQuicVarInt(controlReader);
    const precedingGroupOffset = await deserializeQuicVarInt(controlReader);
    const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH, controlReader);
    result = { ...result, joiningRequestId, precedingGroupOffset, parameters };
  }

  return result;
}