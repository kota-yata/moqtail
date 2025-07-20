import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, setUint8, getUint8 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeParams, type Parameter, serializeParams } from '../utils/parameter';
import { getUint16, setUint16 } from 'bytes';

export const serializeSubscribeUpdate = (props: { requestId: number, startGroup: number, startObject: number, endGroup: number, subscriberPriority: number, parameters: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_UPDATE);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const startGroupBytes = serializeQuicVarInt(props.startGroup);
  const startObjectBytes = serializeQuicVarInt(props.startObject);
  const endGroupBytes = serializeQuicVarInt(props.endGroup);
  const subscriberPriorityBytes = setUint8(props.subscriberPriority);
  const parametersBytes = serializeParams(props.parameters);
  const body = concatUint8Arrays([requestIdBytes, startGroupBytes, startObjectBytes, endGroupBytes, subscriberPriorityBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeSubscribeUpdate = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const startGroup = await deserializeQuicVarInt(controlReader);
  const startObject = await deserializeQuicVarInt(controlReader);
  const endGroup = await deserializeQuicVarInt(controlReader);
  const subscriberPriority = await getUint8(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_UPDATE, controlReader);
  return { requestId, startGroup, startObject, endGroup, subscriberPriority, parameters };
}
