import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ANNOUNCES_ERROR_REASON } from '../constants';
export const serializeSubscribeAnnouncesError = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_ANNOUNCES_ERROR);
    const trackNamespacePrefixLength = numberToVarInt(props.trackNamespacePrefix.length);
    const trackNamespacePrefixBytes = props.trackNamespacePrefix.map(stringToVarBytes);
    const errorCodeBytes = numberToVarInt(props.errorCode);
    const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
    const body = concatBuffer([trackNamespacePrefixLength, ...trackNamespacePrefixBytes, errorCodeBytes, reasonPhraseBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeSubscribeAnnouncesError = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespacePrefixLength = await varIntToNumber(controlReader);
    const trackNamespacePrefix = await Promise.all(Array.from({ length: trackNamespacePrefixLength }, () => varBytesToString(controlReader)));
    const errorCode = await varIntToNumber(controlReader);
    if (!Object.values(SUBSCRIBE_ANNOUNCES_ERROR_REASON).includes(errorCode)) {
        throw new Error(`Invalid Subscribe Announces Error Code: ${errorCode}`);
    }
    const reasonPhrase = await varBytesToString(controlReader);
    return { trackNamespacePrefix, errorCode, reasonPhrase };
};
