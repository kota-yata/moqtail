import { concatBuffer, serializeQuicVarInt, stringToVarBytes, varBytesToString, deserializeQuicVarInt } from "./bytes"

export interface Parameter {
  type: number,
  value: string | number
}

export const serializeParams = (params: Parameter[]): Uint8Array => {
  const serialized = params.map(param => {
    const type = serializeQuicVarInt(param.type);
    let value: Uint8Array;
    if (param.type % 2 === 0) {
      value = serializeQuicVarInt(param.value as number);
    } else {
      value = stringToVarBytes(param.value as string);
    }
    return concatBuffer([type, value]);
  });
  const numParams = serializeQuicVarInt(params.length);
  return concatBuffer([numParams, ...serialized]);
}

export const deserializeParams = async (_messageType: number, controlReader: ReadableStream): Promise<Parameter[]> => {
  const ret: Parameter[] = [];
  const numParams = await deserializeQuicVarInt(controlReader);
  for (let i = 0; i < numParams; i++) {
    const paramId = await deserializeQuicVarInt(controlReader);
    if (paramId % 2 === 0) {
      ret.push({ type: paramId, value: await deserializeQuicVarInt(controlReader) });
    } else {
      ret.push({ type: paramId, value: await varBytesToString(controlReader) });
    }
  }
  return ret;
}
