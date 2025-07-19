import { serializeQuicVarInt, stringToVarBytes, concatUint8Arrays, deserializeQuicVarInt, varBytesToString } from 'bytes';
import { CONTROL_MESSAGE, TRACK_STATUS_CODE } from '../constants';
import { deserializeNamespace, validateFullTrackName } from '../utils/namespace';
import { getUint16, setUint16 } from 'bytes';
import { serializeParams, deserializeParams, type Parameter } from '../utils/parameter';
import { serializeLocation, deserializeLocation, type Location } from '../utils/location';

export const serializeTrackStatus = (props: { requestId: number, statusCode: TRACK_STATUS_CODE, largestLocation: Location, parameters?: Parameter[] }) => {
  const messageTypeBytes = serializeQuicVarInt(CONTROL_MESSAGE.TRACK_STATUS);
  const requestIdBytes = serializeQuicVarInt(props.requestId);
  const statusCodeBytes = serializeQuicVarInt(props.statusCode);
  const largestLocationBytes = serializeLocation(props.largestLocation);
  const parametersBytes = serializeParams(props.parameters || []);
  const body = concatUint8Arrays([requestIdBytes, statusCodeBytes, largestLocationBytes, parametersBytes]);
  const length = setUint16(body.byteLength);
  return concatUint8Arrays([messageTypeBytes, length, body]);
}

export const deserializeTrackStatus = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const requestId = await deserializeQuicVarInt(controlReader);
  const statusCode = await deserializeQuicVarInt(controlReader) as TRACK_STATUS_CODE;
  if (!Object.values(TRACK_STATUS_CODE).includes(statusCode)) {
    throw new Error(`Invalid Track Status Code: ${statusCode}`);
  }
  const largestLocation = await deserializeLocation(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.TRACK_STATUS, controlReader);
  return { requestId, statusCode, largestLocation, parameters };
}
