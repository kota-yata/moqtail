import { CONTROL_MESSAGE } from "../constants";
import { deserializeParams, serializeParams } from "../utils/parameter";
import { concatBuffer, numberToVarInt, varIntToNumber } from "../utils/bytes";
export const serializeClientSetup = (props) => {
    const messageType = numberToVarInt(CONTROL_MESSAGE.CLIENT_SETUP);
    const versionLength = numberToVarInt(props.supportedVersions.length);
    const version = props.supportedVersions.map(version => numberToVarInt(version));
    const concatenatedVersions = concatBuffer(version);
    const params = serializeParams(props.params);
    const length = numberToVarInt(concatBuffer([versionLength, concatenatedVersions, params]).byteLength);
    return concatBuffer([messageType, length, versionLength, concatenatedVersions, params]);
};
export const deserializeClientSetup = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const versionLength = await varIntToNumber(controlReader);
    let versions = [];
    for (let i = 0; i < versionLength; i++) {
        versions.push(await varIntToNumber(controlReader));
    }
    const parameters = await deserializeParams(CONTROL_MESSAGE.CLIENT_SETUP, controlReader);
    return { versions, parameters };
};
