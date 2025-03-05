import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, serializeParams } from "../utils/parameter";
import { concatBuffer, numberToVarInt, varIntToNumber } from "../utils/bytes";
export const serializeServerSetup = (props) => {
    const messageType = numberToVarInt(CONTROL_MESSAGE.SERVER_SETUP);
    const selectedVersion = numberToVarInt(props.version);
    const params = serializeParams(props.params);
    const length = numberToVarInt(concatBuffer([selectedVersion, params]).byteLength);
    return concatBuffer([messageType, length, selectedVersion, params]);
};
export const deserializeServerSetup = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const selectedVersion = await varIntToNumber(controlReader);
    const parameters = await deserializeParams(CONTROL_MESSAGE.SERVER_SETUP, controlReader);
    return { selectedVersion, parameters };
};
