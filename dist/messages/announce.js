import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams } from '../utils/parameter';
export const serializeAnnounce = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.ANNOUNCE);
    const trackNamespaceLength = numberToVarInt(props.trackNamespace.length);
    const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
    const parametersBytes = serializeParams(props.parameters || []);
    const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes, parametersBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeAnnounce = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespaceLength = await varIntToNumber(controlReader);
    const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
    const parameters = await deserializeParams(CONTROL_MESSAGE.ANNOUNCE, controlReader);
    return { trackNamespace, parameters };
};
