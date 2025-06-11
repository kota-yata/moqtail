import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, setUint8, getUint8 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeParams, type Parameter, serializeParams } from '../utils/parameter';

export const serializeFetchOk = (props: { subscribeId: number, groupOrder: number, endOfTrack: number, largestGroupId: number, largestObjectId: number, parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_OK);
  const subscribeIdBytes = serializeQuicVarInt(props.subscribeId);
  const groupOrderBytes = setUint8(props.groupOrder);
  const endOfTrackBytes = setUint8(props.endOfTrack);
  const largestGroupIdBytes = serializeQuicVarInt(props.largestGroupId);
  const largestObjectIdBytes = serializeQuicVarInt(props.largestObjectId);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([subscribeIdBytes, groupOrderBytes, endOfTrackBytes, largestGroupIdBytes, largestObjectIdBytes, parametersBytes]);
  const length = serializeQuicVarInt(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeFetchOk = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const subscribeId = await deserializeQuicVarInt(controlReader);
  const groupOrder = await getUint8(controlReader);
  const endOfTrack = await getUint8(controlReader);
  const largestGroupId = await deserializeQuicVarInt(controlReader);
  const largestObjectId = await deserializeQuicVarInt(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH_OK, controlReader);
  return { subscribeId, groupOrder, endOfTrack, largestGroupId, largestObjectId, parameters };
}
