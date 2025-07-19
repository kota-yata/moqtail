import { serializeQuicVarInt, concatUint8Arrays, deserializeQuicVarInt, setUint8, getUint8 } from 'bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeParams, type Parameter, serializeParams } from '../utils/parameter';
import { getUint16, setUint16 } from 'bytes';

export const serializeFetchOk = (props: { requestId: number, groupOrder: number, endOfTrack: number, largestGroupId: number, largestObjectId: number, parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.FETCH_OK);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const groupOrderBytes = setUint8(props.groupOrder);
  const endOfTrackBytes = setUint8(props.endOfTrack);
  const largestGroupIdBytes = serializeQuicVarInt(props.largestGroupId);
  const largestObjectIdBytes = serializeQuicVarInt(props.largestObjectId);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, groupOrderBytes, endOfTrackBytes, largestGroupIdBytes, largestObjectIdBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeFetchOk = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const groupOrder = await getUint8(controlReader);
  const endOfTrack = await getUint8(controlReader);
  const largestGroupId = await deserializeQuicVarInt(controlReader);
  const largestObjectId = await deserializeQuicVarInt(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH_OK, controlReader);
  return { requestId, groupOrder, endOfTrack, largestGroupId, largestObjectId, parameters };
}
