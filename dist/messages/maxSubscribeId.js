import { CONTROL_MESSAGE } from "../constants";
import { concatBuffer, numberToVarInt, varIntToNumber } from "../utils/bytes";
export const serializeMaxSubscribeId = (props) => {
    const messageType = numberToVarInt(CONTROL_MESSAGE.MAX_SUBSCRIBE_ID);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const length = numberToVarInt(subscribeIdBytes.byteLength);
    return concatBuffer([messageType, length, subscribeIdBytes]);
};
export const deserializeMaxSubscribeId = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    return { subscribeId };
};
