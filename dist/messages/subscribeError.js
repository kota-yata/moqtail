import { numberToVarInt, stringToVarBytes, concatBuffer, varIntToNumber, varBytesToString } from '../utils/bytes';
import { CONTROL_MESSAGE, SUBSCRIBE_ERROR_REASON } from '../constants';
export const serializeSubscribeError = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_ERROR);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const errorCodeBytes = numberToVarInt(props.errorCode);
    const reasonPhraseBytes = stringToVarBytes(props.reasonPhrase);
    const trackAliasBytes = numberToVarInt(props.trackAlias);
    const body = concatBuffer([subscribeIdBytes, errorCodeBytes, reasonPhraseBytes, trackAliasBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, subscribeIdBytes, errorCodeBytes, reasonPhraseBytes, trackAliasBytes]);
};
export const deserializeSubscribeError = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    const errorCode = await varIntToNumber(controlReader);
    if (!Object.values(SUBSCRIBE_ERROR_REASON).includes(errorCode)) {
        throw new Error(`Invalid Subscribe Error Code: ${errorCode}`);
    }
    const reasonPhrase = await varBytesToString(controlReader);
    const trackAlias = await varIntToNumber(controlReader);
    return { subscribeId, errorCode, reasonPhrase, trackAlias };
};
