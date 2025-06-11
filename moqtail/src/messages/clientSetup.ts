import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, serializeParams, type Parameter } from "../utils/parameter";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";

export const serializeClientSetup = (props: { supportedVersions: number[], params?: Parameter[] }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.CLIENT_SETUP);
  const versionLength = serializeQuicVarInt(props.supportedVersions.length);
  const version = props.supportedVersions.map(version => serializeQuicVarInt(version));
  const concatenatedVersions = concatUint8Arrays(version);
  const parametersBytes = serializeParams(props.params || []);
  const length = serializeQuicVarInt(concatUint8Arrays([versionLength, concatenatedVersions, parametersBytes]).byteLength);
  return concatUint8Arrays([messageType, length, versionLength, concatenatedVersions, parametersBytes]);
}

export const deserializeClientSetup = async (controlReader: ReadableStream) => {
  await deserializeQuicVarInt(controlReader); // length
  const versionLength = await deserializeQuicVarInt(controlReader);
  let versions: number[] = [];
  for (let i = 0; i < versionLength; i++) {
    versions.push(await deserializeQuicVarInt(controlReader));
  }
  const parameters = await deserializeParams(CONTROL_MESSAGE.CLIENT_SETUP, controlReader);
  return { versions, parameters };
}