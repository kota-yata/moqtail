import { MOQT_DRAFT10_VERSION, CONTROL_MESSAGE } from "../constants";
import { concatBuffer, numberToVarInt, readParams, varIntToNumber } from "../utils/bytes";

export const generateSetup = (props: { role: number }) => {
  const messageType = numberToVarInt(CONTROL_MESSAGE.CLIENT_SETUP);
  const versionLength = numberToVarInt(1);
  const version = numberToVarInt(MOQT_DRAFT10_VERSION);
  const numberOfParams = numberToVarInt(0);
  return concatBuffer([messageType, versionLength, version, numberOfParams]);
}
export const readSetup = async (controlReader: ReadableStream) => {
  const version = await varIntToNumber(controlReader);
  const parameters = await readParams(controlReader);
  return { version, parameters };
}