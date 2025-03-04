import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, Parameter, serializeParams } from "../parameter";
import { concatBuffer, numberToVarInt, varIntToNumber } from "../utils/bytes";

export const serializeClientSetup = (props: { supportedVersions: number[], params: Parameter[] }) => {
  const messageType = numberToVarInt(CONTROL_MESSAGE.CLIENT_SETUP);
  const versionLength = numberToVarInt(props.supportedVersions.length);
  const version = props.supportedVersions.map(version => numberToVarInt(version));
  const concatenatedVersions = concatBuffer(version);
  const params = serializeParams(props.params);
  return concatBuffer([messageType, versionLength, concatenatedVersions, params]);
}

export const readClientSetup = async (controlReader: ReadableStream) => {
  const version = await varIntToNumber(controlReader);
  const parameters = await deserializeParams(CONTROL_MESSAGE.CLIENT_SETUP, controlReader);
  return { version, parameters };
}