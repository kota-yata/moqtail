import { CONTROL_MESSAGE, PARAMETER } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from 'bytes';
import { serializeKeyValuePair, deserializeKeyValuePair, type KeyValuePair } from './keyValuePair';
import { serializeAuthToken } from "./authToken";

export interface Parameter {
  type: number,
  value: any
}

export const serializeParams = (params: Parameter[]): Uint8Array => {
  const serialized = params.map(param => {
    // Convert Parameter to KeyValuePair format
    let keyValuePair: KeyValuePair;
    
    if (param.type % 2 === 0) {
      // Even type: value should be a number (varint)
      if (typeof param.value !== 'number') {
        throw new Error(`Even parameter type ${param.type} requires number value`);
      }
      keyValuePair = { type: param.type, value: param.value };
    } else {
      let valueBytes: Uint8Array;
      switch (param.type) {
        case PARAMETER.AUTHORIZATION_INFO.KEY:
          valueBytes = serializeAuthToken(param.value);
          break;
        default:
          const encoder = new TextEncoder();
          valueBytes = encoder.encode(param.value);
      }
      keyValuePair = { type: param.type, value: valueBytes };
    }
    
    return serializeKeyValuePair(keyValuePair);
  });
  const numParams = serializeQuicVarInt(params.length);
  return concatUint8Arrays([numParams, ...serialized]);
}

export const deserializeParams = async (messageType: number, controlReader: ReadableStream): Promise<Parameter[]> => {
  const ret: Parameter[] = [];
  const numParams = await deserializeQuicVarInt(controlReader);
  
  for (let i = 0; i < numParams; i++) {
    // Deserialize using Key-Value-Pair format
    const keyValuePair = await deserializeKeyValuePair(controlReader);
    
    // Convert KeyValuePair back to Parameter format
    let parameter: Parameter;
    
    if (keyValuePair.type % 2 === 0) {
      // Even type: value is a number
      if (typeof keyValuePair.value !== 'number') {
        throw new Error(`Even parameter type ${keyValuePair.type} should have number value`);
      }
      parameter = { type: keyValuePair.type, value: keyValuePair.value };
    } else {
      // Odd type: value is bytes, convert to string
      if (!(keyValuePair.value instanceof Uint8Array)) {
        throw new Error(`Odd parameter type ${keyValuePair.type} should have Uint8Array value`);
      }
      const decoder = new TextDecoder('utf-8');
      const stringValue = decoder.decode(keyValuePair.value);
      parameter = { type: keyValuePair.type, value: stringValue };
    }
    
    // Validate known parameter types
    if (messageType === CONTROL_MESSAGE.CLIENT_SETUP || messageType === CONTROL_MESSAGE.SERVER_SETUP) {
      switch (keyValuePair.type) {
        case PARAMETER.SETUP.PATH.KEY:
        case PARAMETER.SETUP.MAX_REQUEST_ID.KEY:
        case PARAMETER.SETUP.MAX_AUTH_TOKEN_CACHE_SIZE.KEY:
          ret.push(parameter);
          break;
        default:
          throw new Error(`unexpected setup parameter ${keyValuePair.type}`); // TODO: ProtocolViolation
      }
    } else {
      switch (keyValuePair.type) {
        case PARAMETER.AUTHORIZATION_INFO.KEY:
        case PARAMETER.DELIVERY_TIMEOUT.KEY:
        case PARAMETER.MAX_CACHE_DURATION.KEY:
          ret.push(parameter);
          break;
        default:
          throw new Error(`unexpected parameter ${keyValuePair.type}`); // TODO: ProtocolViolation
      }
    }
  }
  return ret;
}
