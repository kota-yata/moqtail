import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, type Parameter, serializeParams } from "../utils/parameter";
import { concatBuffer, serializeQuicVarInt, deserializeQuicVarInt, setUint16, getUint16 } from "../utils/bytes";

export const serializeServerSetup = (props: ServerSetup) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SERVER_SETUP);
  const selectedVersion = serializeQuicVarInt(props.selectedVersion);
  const params = serializeParams(props.parameters);
  const length = setUint16(concatBuffer([selectedVersion, params]).byteLength);
  return concatBuffer([messageType, length, selectedVersion, params]);
}

export const deserializeServerSetup = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const selectedVersion = await deserializeQuicVarInt(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SERVER_SETUP, controlReader);
  return { selectedVersion, parameters };
}

export interface ServerSetup {
  selectedVersion: number;
  parameters: Parameter[];
}