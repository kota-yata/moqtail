import { numberToVarInt, concatBuffer, varIntToNumber, setUint8, getUint8 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeParams, serializeParams } from '../utils/parameter';
export const serializeFetchOk = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.FETCH_OK);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const groupOrderBytes = setUint8(props.groupOrder);
    const endOfTrackBytes = setUint8(props.endOfTrack);
    const largestGroupIdBytes = numberToVarInt(props.largestGroupId);
    const largestObjectIdBytes = numberToVarInt(props.largestObjectId);
    const parametersBytes = serializeParams(props.parameters || []);
    const body = concatBuffer([subscribeIdBytes, groupOrderBytes, endOfTrackBytes, largestGroupIdBytes, largestObjectIdBytes, parametersBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeFetchOk = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    const groupOrder = await getUint8(controlReader);
    const endOfTrack = await getUint8(controlReader);
    const largestGroupId = await varIntToNumber(controlReader);
    const largestObjectId = await varIntToNumber(controlReader);
    const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH_OK, controlReader);
    return { subscribeId, groupOrder, endOfTrack, largestGroupId, largestObjectId, parameters };
};
