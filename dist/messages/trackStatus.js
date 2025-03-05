import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, TRACK_STATUS_CODE } from '../constants';
export const serializeTrackStatus = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.TRACK_STATUS);
    const trackNamespaceLength = numberToVarInt(props.trackNamespace.length);
    const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
    const trackNameBytes = stringToVarBytes(props.trackName);
    const statusCodeBytes = numberToVarInt(props.statusCode);
    const lastGroupIdBytes = numberToVarInt(props.lastGroupId);
    const lastObjectIdBytes = numberToVarInt(props.lastObjectId);
    const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes, statusCodeBytes, lastGroupIdBytes, lastObjectIdBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeTrackStatus = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespaceLength = await varIntToNumber(controlReader);
    const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
    const trackName = await varBytesToString(controlReader);
    const statusCode = await varIntToNumber(controlReader);
    if (!Object.values(TRACK_STATUS_CODE).includes(statusCode)) {
        throw new Error(`Invalid Track Status Code: ${statusCode}`);
    }
    const lastGroupId = await varIntToNumber(controlReader);
    const lastObjectId = await varIntToNumber(controlReader);
    return { trackNamespace, trackName, statusCode, lastGroupId, lastObjectId };
};
