import { numberToVarInt, concatBuffer, varIntToNumber, stringToVarBytes, varBytesToString, setUint8, getUint8 } from '../utils/bytes';
import { CONTROL_MESSAGE, FETCH_TYPE } from '../constants';
import { deserializeParams, serializeParams } from '../utils/parameter';
export const serializeFetch = (props) => {
    const messageTypeBytes = numberToVarInt(CONTROL_MESSAGE.FETCH);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const subscriberPriorityBytes = setUint8(props.subscriberPriority);
    const groupOrderBytes = setUint8(props.groupOrder);
    const fetchTypeBytes = numberToVarInt(props.fetchType);
    let body;
    if (props.fetchType === FETCH_TYPE.STANDALONE) {
        if (!props.trackNamespace || !props.trackName || !props.startGroup || !props.startObject || !props.endGroup || !props.endObject) {
            throw new Error('Invalid Fetch props for Standalone');
        }
        const trackNamespaceLength = numberToVarInt(props.trackNamespace.length);
        const trackNamespaceBytes = props.trackNamespace.map(stringToVarBytes);
        const trackNameBytes = stringToVarBytes(props.trackName);
        const startGroupBytes = numberToVarInt(props.startGroup);
        const startObjectBytes = numberToVarInt(props.startObject);
        const endGroupBytes = numberToVarInt(props.endGroup);
        const endObjectBytes = numberToVarInt(props.endObject);
        const parametersBytes = serializeParams(props.parameters || []);
        body = concatBuffer([subscribeIdBytes, subscriberPriorityBytes, groupOrderBytes, fetchTypeBytes, trackNamespaceLength, ...trackNamespaceBytes, trackNameBytes, startGroupBytes, startObjectBytes, endGroupBytes, endObjectBytes, parametersBytes]);
    }
    else {
        if (!props.joiningSubscribeId || !props.precedingGroupOffset) {
            throw new Error('Invalid Fetch props for Joining');
        }
        const joiningSubscribeIdBytes = numberToVarInt(props.joiningSubscribeId);
        const precedingGroupOffsetBytes = numberToVarInt(props.precedingGroupOffset);
        const parametersBytes = serializeParams(props.parameters || []);
        body = concatBuffer([subscribeIdBytes, subscriberPriorityBytes, groupOrderBytes, fetchTypeBytes, joiningSubscribeIdBytes, precedingGroupOffsetBytes, parametersBytes]);
    }
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageTypeBytes, length, body]);
};
export const deserializeFetch = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    const subscriberPriority = await getUint8(controlReader);
    const groupOrder = await getUint8(controlReader);
    const fetchType = await varIntToNumber(controlReader);
    if (fetchType !== FETCH_TYPE.STANDALONE && fetchType !== FETCH_TYPE.JOINING) {
        throw new Error(`Invalid Fetch Type: ${fetchType}`);
    }
    let result = { subscribeId, subscriberPriority, groupOrder, fetchType };
    if (fetchType === FETCH_TYPE.STANDALONE) {
        const trackNamespaceLength = await varIntToNumber(controlReader);
        const trackNamespace = await Promise.all(Array.from({ length: trackNamespaceLength }, () => varBytesToString(controlReader)));
        const trackName = await varBytesToString(controlReader);
        const startGroup = await varIntToNumber(controlReader);
        const startObject = await varIntToNumber(controlReader);
        const endGroup = await varIntToNumber(controlReader);
        const endObject = await varIntToNumber(controlReader);
        const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH, controlReader);
        result = { ...result, trackNamespace, trackName, startGroup, startObject, endGroup, endObject, parameters };
    }
    else {
        const joiningSubscribeId = await varIntToNumber(controlReader);
        const precedingGroupOffset = await varIntToNumber(controlReader);
        const parameters = await deserializeParams(CONTROL_MESSAGE.FETCH, controlReader);
        result = { ...result, joiningSubscribeId, precedingGroupOffset, parameters };
    }
    return result;
};
