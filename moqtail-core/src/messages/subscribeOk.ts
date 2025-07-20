import { CONTENT_EXISTS, CONTROL_MESSAGE } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt, setUint8, getUint8 } from "bytes";
import { deserializeParams, type Parameter, serializeParams } from "../utils/parameter";
import { getUint16, setUint16 } from "bytes";

export const serializeSubscribeOk = (props: SubscribeOk) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SUBSCRIBE_OK);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const expiresBytes = serializeQuicVarInt(props.expires);
  const groupOrderBytes = setUint8(props.groupOrder);
  const contentExistsBytes = setUint8(props.contentExists);
  const largestGroupIdBytes = props.largestGroupId !== undefined ? serializeQuicVarInt(props.largestGroupId) : new Uint8Array();
  const largestObjectIdBytes = props.largestObjectId !== undefined ? serializeQuicVarInt(props.largestObjectId) : new Uint8Array();
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, expiresBytes, groupOrderBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageType, length, body]);
}

export const deserializeSubscribeOk = async (controlReader: ReadableStream): Promise<SubscribeOk> => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const expires = await deserializeQuicVarInt(controlReader);
  const groupOrder = await getUint8(controlReader);
  const contentExists = await getUint8(controlReader) as CONTENT_EXISTS;
  if (contentExists !== CONTENT_EXISTS.NO && contentExists !== CONTENT_EXISTS.YES) {
    throw new Error(`unexpected contentExists value ${contentExists}`); // TODO: ProtocolViolation
  }
  const largestGroupId = contentExists === CONTENT_EXISTS.YES ? await deserializeQuicVarInt(controlReader) : undefined;
  const largestObjectId = contentExists === CONTENT_EXISTS.YES ? await deserializeQuicVarInt(controlReader) : undefined;
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_OK, controlReader);
  return { requestId, expires, groupOrder, contentExists, largestGroupId, largestObjectId, parameters };
}

export interface SubscribeOk {
  requestId: number,
  expires: number,
  groupOrder: number,
  contentExists: CONTENT_EXISTS,
  largestGroupId?: number,
  largestObjectId?: number,
  parameters?: Parameter[]
};
