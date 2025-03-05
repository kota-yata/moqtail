import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
export const serializeUnannounce = (trackNamespace) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.UNANNOUNCE);
    const trackNamespaceLength = numberToVarInt(trackNamespace.length);
    const trackNamespaceBytes = trackNamespace.map(stringToVarBytes);
    const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeUnannounce = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespaceLength = await varIntToNumber(controlReader);
    const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
    return { trackNamespace };
};
