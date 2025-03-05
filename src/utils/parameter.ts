// TODO: Parameter Deserialization

import { CONTROL_MESSAGE, PARAMETER } from "../constants";
import { concatBuffer, numberToVarInt, stringToVarBytes, varBytesToString, varIntToNumber } from "./bytes"

export interface Parameter {
  type: number,
  value: string | number
}

export const serializeParams = (params: Parameter[]) => {
  const serialized = params.map(param => {
    const type = numberToVarInt(param.type);
    const value = typeof param.value === 'string' ? stringToVarBytes(param.value) : numberToVarInt(param.value);
    return concatBuffer([type, value]);
  });
  const numParams = numberToVarInt(params.length);
  return concatBuffer([numParams, ...serialized]);
}

export const deserializeParams = async (messageType: number, controlReader: ReadableStream) => {
  const ret = {
    authInfo: '',
    deliveryTimeout: -1,
    maxCacheDuration: -1,
    setup: {
      path: '',
      maxSubscribeId: -1,
    }
  }
  const numParams = await varIntToNumber(controlReader);
  for (let i = 0; i < numParams; i++) {
    const paramId = await varIntToNumber(controlReader);
    if (messageType === CONTROL_MESSAGE.CLIENT_SETUP || messageType === CONTROL_MESSAGE.SERVER_SETUP) {
      switch (paramId) {
        case PARAMETER.SETUP.PATH.KEY:
          ret.setup.path = await varBytesToString(controlReader);
          break;
        case PARAMETER.SETUP.MAX_SUBSCRIBE_ID.KEY:
          ret.setup.maxSubscribeId = await varIntToNumber(controlReader);
          break
        default:
          throw new Error(`unexpected setup parameter ${paramId}`); // TODO: ProtocolViolation
      }
    } else {
      switch (paramId) {
        case PARAMETER.AUTHORIZATION_INFO.KEY:
          ret.authInfo = await varBytesToString(controlReader);
          break;
        case PARAMETER.DELIVERY_TIMOUT.KEY:
          ret.deliveryTimeout = await varIntToNumber(controlReader);
          break;
        case PARAMETER.MAX_CACHE_DURATION.KEY:
          ret.maxCacheDuration = await varIntToNumber(controlReader);
          break;
        default:
          throw new Error(`unexpected parameter ${paramId}`); // TODO: ProtocolViolation
      }
    }
  }
  return ret;
}
