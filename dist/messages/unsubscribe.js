import { numberToVarInt, concatBuffer, varIntToNumber } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
export const serializeUnsubscribe = (subscribeId) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.UNSUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(subscribeId);
    const body = concatBuffer([subscribeIdBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeUnsubscribe = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    return { subscribeId };
};
