import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { serializeParams, deserializeParams } from '../utils/parameter';
export const serializeSubscribeAnnounces = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES);
    const trackNamespacePrefixLength = numberToVarInt(props.trackNamespacePrefix.length);
    const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
    const parametersBytes = serializeParams(props.parameters || []);
    const body = concatBuffer([trackNamespacePrefixLength, ...trackNamespacePrefixBytes, parametersBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeSubscribeAnnounces = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespacePrefixLength = await varIntToNumber(controlReader);
    const trackNamespacePrefix = await Promise.all(Array.from({ length: trackNamespacePrefixLength }, () => varBytesToString(controlReader)));
    const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES, controlReader);
    return { trackNamespacePrefix, parameters };
};
