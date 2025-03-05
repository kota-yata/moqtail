import { numberToVarInt, concatBuffer, varIntToNumber, setUint8, getUint8 } from '../utils/bytes';
import { CONTROL_MESSAGE } from '../constants';
import { deserializeParams, serializeParams } from '../utils/parameter';
export const serializeSubscribeUpdate = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE_UPDATE);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const startGroupBytes = numberToVarInt(props.startGroup);
    const startObjectBytes = numberToVarInt(props.startObject);
    const endGroupBytes = numberToVarInt(props.endGroup);
    const subscriberPriorityBytes = setUint8(props.subscriberPriority);
    const parametersBytes = serializeParams(props.parameters);
    const body = concatBuffer([subscribeIdBytes, startGroupBytes, startObjectBytes, endGroupBytes, subscriberPriorityBytes, parametersBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeSubscribeUpdate = async (controlReader) => {
    const subscribeId = await varIntToNumber(controlReader);
    const startGroup = await varIntToNumber(controlReader);
    const startObject = await varIntToNumber(controlReader);
    const endGroup = await varIntToNumber(controlReader);
    const subscriberPriority = await getUint8(controlReader);
    const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE_UPDATE, controlReader);
    return { subscribeId, startGroup, startObject, endGroup, subscriberPriority, parameters };
};
