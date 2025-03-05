import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, ANNOUNCE_ERROR_REASON } from '../constants';
export const serializeAnnounceCancel = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.ANNOUNCE_CANCEL);
    const trackNamespaceLength = numberToVarInt(props.trackNamespace.length);
    const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
    const errorCodeBytes = numberToVarInt(props.errorCode);
    const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
    const body = concatBuffer([trackNamespaceLength, ...trackNamespaceBytes, errorCodeBytes, reasonPhraseBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeAnnounceCancel = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const trackNamespaceLength = await varIntToNumber(controlReader);
    const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
    const errorCode = await varIntToNumber(controlReader);
    if (!Object.values(ANNOUNCE_ERROR_REASON).includes(errorCode)) {
        throw new Error(`Invalid Announce Cancel Error Code: ${errorCode}`);
    }
    const reasonPhrase = await varBytesToString(controlReader);
    return { trackNamespace, errorCode, reasonPhrase };
};
