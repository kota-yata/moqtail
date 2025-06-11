import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, type Parameter, serializeParams } from "../utils/parameter";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";

export const serializeServerSetup = (props: ServerSetup) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.SERVER_SETUP);
  const selectedVersion = serializeQuicVarInt(props.selectedVersion);
  const params = serializeParams(props.parameters);
  const length = serializeQuicVarInt(concatUint8Arrays([selectedVersion, params]).byteLength);
  return concatUint8Arrays([messageType, length, selectedVersion, params]);
}

export const deserializeServerSetup = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const selectedVersion = await deserializeQuicVarInt(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.SERVER_SETUP, controlReader);
  return { selectedVersion, parameters };
}

export interface ServerSetup {
  selectedVersion: number;
  parameters: Parameter[];
}