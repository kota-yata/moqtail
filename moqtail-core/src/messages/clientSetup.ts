import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, serializeParams, type Parameter } from "../utils/parameter";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "../utils/bytes";
import { getUint16, setUint16 } from "../utils/bytes";

/** Serialize a CLIENT_SETUP control message. */
export const serializeClientSetup = (props: { supportedVersions: number[], params?: Parameter[] }) => {
  const messageType = serializeQuicVarInt(CONTROL_MESSAGE.CLIENT_SETUP);
  const versionLength = serializeQuicVarInt(props.supportedVersions.length);
  const version = props.supportedVersions.map(version => serializeQuicVarInt(version));
  const concatenatedVersions = concatUint8Arrays(version);
  const parametersBytes = serializeParams(props.params || []);
  const length = setUint16(concatUint8Arrays([versionLength, concatenatedVersions, parametersBytes]).byteLength);
  return concatUint8Arrays([messageType, length, versionLength, concatenatedVersions, parametersBytes]);
}

/** Deserialize a CLIENT_SETUP control message. */
export const deserializeClientSetup = async (controlReader: ReadableStream) => {
  await getUint16(controlReader); // length
  const versionLength = await deserializeQuicVarInt(controlReader);
  let versions: number[] = [];
  for (let i = 0; i < versionLength; i++) {
    versions.push(await deserializeQuicVarInt(controlReader));
  }
  const parameters = await deserializeParams(CONTROL_MESSAGE.CLIENT_SETUP, controlReader);
  return { versions, parameters };
}
