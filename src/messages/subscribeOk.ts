import { CONTENT_EXISTS, CONTROL_MESSAGE } from "../constants";
import { concatBuffer, numberToVarInt, varIntToNumber, setUint8, getUint8 } from "../utils/bytes";
import { deserializeParams, Parameter, serializeParams } from "../utils/parameter";

export const serializeSubscribeOk = (props: { subscribeId: number, expires: number, groupOrder: number, contentExists: CONTENT_EXISTS, largestGroupId?: number, largestObjectId?: number, parameters?: Parameter[] }) => {
  const messageType = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_OK);
  const subscribeIdBytes = numberToVarInt(props.subscribeId);
  const expiresBytes = numberToVarInt(props.expires);
  const groupOrderBytes = setUint8(props.groupOrder);
  const contentExistsBytes = setUint8(props.contentExists);
  const largestGroupIdBytes = props.largestGroupId !== undefined ? numberToVarInt(props.largestGroupId) : new Uint8Array();
  const largestObjectIdBytes = props.largestObjectId !== undefined ? numberToVarInt(props.largestObjectId) : new Uint8Array();
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatBuffer([subscribeIdBytes, expiresBytes, groupOrderBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes, parametersBytes]);
  const length = numberToVarInt(body.byteLength);
  return concatBuffer([messageType, length, body]);
}

export const deserializeSubscribeOk = async (controlReader: ReadableStream) => {
  await varIntToNumber(controlReader); // length
  const subscribeId = await varIntToNumber(controlReader);
  const expires = await varIntToNumber(controlReader);
  const groupOrder = await getUint8(controlReader);
  const contentExists = await getUint8(controlReader) as CONTENT_EXISTS;
  if (contentExists !== CONTENT_EXISTS.NO && contentExists !== CONTENT_EXISTS.YES) {
    throw new Error(`unexpected contentExists value ${contentExists}`); // TODO: ProtocolViolation
  }
  const largestGroupId = contentExists === CONTENT_EXISTS.YES ? await varIntToNumber(controlReader) : undefined;
  const largestObjectId = contentExists === CONTENT_EXISTS.YES ? await varIntToNumber(controlReader) : undefined;
  const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_OK, controlReader);
  return { subscribeId, expires, groupOrder, contentExists, largestGroupId, largestObjectId, parameters };
}
