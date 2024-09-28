import { MOQ_DRAFT04_VERSION, MOQ_MESSAGE, MOQ_PARAMETER_ROLE } from "../constants";
import { concatBuffer, numberToVarInt, readParams, varIntToNumber } from "../utils/bytes";

export const generateSetup = (props: { role: number }) => {
  const messageType = numberToVarInt(MOQ_MESSAGE.CLIENT_SETUP);
  const versionLength = numberToVarInt(1);
  const version = numberToVarInt(MOQ_DRAFT04_VERSION);
  const numberOfParams = numberToVarInt(1);
  const roleParamId = numberToVarInt(MOQ_PARAMETER_ROLE.KEY);
  const roleParamData = numberToVarInt(props.role);
  const roleParamRoleLength = numberToVarInt(roleParamData.byteLength);
  return concatBuffer([messageType, versionLength, version, numberOfParams, roleParamId, roleParamRoleLength, roleParamData]);
}
export const readSetup = async (controlReader: ReadableStream) => {
  const version = await varIntToNumber(controlReader);
  const parameters = await readParams(controlReader);
  return { version, parameters };
}