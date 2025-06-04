import { CONTROL_MESSAGE, PARAMETER } from "../constants";
import { concatBuffer, getQuicVarIntLength, serializeQuicVarInt, stringToVarBytes, varBytesToString, deserializeQuicVarInt } from "./bytes"

export interface Parameter {
  type: number,
  value: string | number
}

export const serializeParams = (params: Parameter[]): Uint8Array => {
  const serialized = params.map(param => {
    const type = serializeQuicVarInt(param.type);
    let len: Uint8Array = new Uint8Array(0);
    let value: Uint8Array;
    if (typeof param.value === 'string') {
      value = stringToVarBytes(param.value);
    } else {
      len = serializeQuicVarInt(getQuicVarIntLength(param.value));
      value = serializeQuicVarInt(param.value);
    }
    return concatBuffer([type, len, value]);
  });
  const numParams = serializeQuicVarInt(params.length);
  return concatBuffer([numParams, ...serialized]);
}

export const deserializeParams = async (messageType: number, controlReader: ReadableStream): Promise<Parameter[]> => {
  const ret: Parameter[] = [];
  const numParams = await deserializeQuicVarInt(controlReader);
  for (let i = 0; i < numParams; i++) {
    const paramId = await deserializeQuicVarInt(controlReader);
    if (messageType === CONTROL_MESSAGE.CLIENT_SETUP || messageType === CONTROL_MESSAGE.SERVER_SETUP) {
      switch (paramId) {
        case PARAMETER.SETUP.PATH.KEY:
          ret.push({ type: PARAMETER.SETUP.PATH.KEY, value: await varBytesToString(controlReader) });
          break;
        case PARAMETER.SETUP.MAX_REQUEST_ID.KEY:
          await deserializeQuicVarInt(controlReader); // length
          ret.push({ type: PARAMETER.SETUP.MAX_REQUEST_ID.KEY, value: await deserializeQuicVarInt(controlReader) });
          break
        case PARAMETER.SETUP.MAX_AUTH_TOKEN_CACHE_SIZE.KEY:
          break;
        default:
          throw new Error(`unexpected setup parameter ${paramId}`); // TODO: ProtocolViolation
      }
    } else {
      switch (paramId) {
        case PARAMETER.AUTHORIZATION_TOKEN.KEY:
          ret.push({ type: PARAMETER.AUTHORIZATION_TOKEN.KEY, value: await varBytesToString(controlReader) });
          break;
        case PARAMETER.DELIVERY_TIMEOUT.KEY:
          await deserializeQuicVarInt(controlReader); // length
          ret.push({ type: PARAMETER.DELIVERY_TIMEOUT.KEY, value: await deserializeQuicVarInt(controlReader) });
          break;
        case PARAMETER.MAX_CACHE_DURATION.KEY:
          await deserializeQuicVarInt(controlReader); // length
          ret.push({ type: PARAMETER.MAX_CACHE_DURATION.KEY, value: await deserializeQuicVarInt(controlReader) });
          break;
        default:
          throw new Error(`unexpected parameter ${paramId}`); // TODO: ProtocolViolation
      }
    }
  }
  return ret;
}
