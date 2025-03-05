import { CONTROL_MESSAGE, GROUP_ORDER, SUBSCRIBE_FILTER } from "../constants";
import { deserializeParams, serializeParams } from "../utils/parameter";
import { concatBuffer, numberToVarInt, stringToVarBytes, varIntToNumber, varBytesToString, setUint8, getUint8 } from "../utils/bytes";
export const serializeSubscribe = (props) => {
    const messageType = numberToVarInt(CONTROL_MESSAGE.SUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(props.subscribeId);
    const trackAliasBytes = numberToVarInt(props.trackAlias);
    const namespaceLength = numberToVarInt(props.namespace.length);
    const namespaceBytes = props.namespace.map(stringToVarBytes);
    const trackNameBytes = stringToVarBytes(props.trackName);
    const subscriberPriorityBytes = setUint8(props.subscriberPriority);
    const groupOrderBytes = setUint8(props.groupOrder);
    const filterTypeBytes = numberToVarInt(props.filterType);
    const startGroupBytes = props.startGroup !== undefined ? numberToVarInt(props.startGroup) : new Uint8Array();
    const startObjectBytes = props.startObject !== undefined ? numberToVarInt(props.startObject) : new Uint8Array();
    const endGroupBytes = props.endGroup !== undefined ? numberToVarInt(props.endGroup) : new Uint8Array();
    const parametersBytes = serializeParams(props.parameters || []);
    const body = concatBuffer([subscribeIdBytes, trackAliasBytes, namespaceLength, ...namespaceBytes, trackNameBytes, subscriberPriorityBytes, groupOrderBytes, filterTypeBytes, startGroupBytes, startObjectBytes, endGroupBytes, parametersBytes]);
    const length = numberToVarInt(body.byteLength);
    return concatBuffer([messageType, length, body]);
};
export const deserializeSubscribe = async (controlReader) => {
    await varIntToNumber(controlReader); // length
    const subscribeId = await varIntToNumber(controlReader);
    const trackAlias = await varIntToNumber(controlReader);
    const namespaceLength = await varIntToNumber(controlReader);
    const namespace = await Promise.all(Array.from({ length: namespaceLength }, () => varBytesToString(controlReader)));
    const trackName = await varBytesToString(controlReader);
    const subscriberPriority = await getUint8(controlReader);
    const groupOrder = await getUint8(controlReader);
    if (!Object.values(GROUP_ORDER).includes(groupOrder)) {
        throw new Error(`Invalid Group Order: ${groupOrder}`);
    }
    const filterType = await varIntToNumber(controlReader);
    if (!Object.values(SUBSCRIBE_FILTER).includes(filterType)) {
        throw new Error(`Invalid Subscribe Filter Type: ${filterType}`);
    }
    const startGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await varIntToNumber(controlReader) : undefined;
    const startObject = filterType === SUBSCRIBE_FILTER.ABSOLUTE_START || filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await varIntToNumber(controlReader) : undefined;
    const endGroup = filterType === SUBSCRIBE_FILTER.ABSOLUTE_RANGE ? await varIntToNumber(controlReader) : undefined;
    const parameters = await deserializeParams(CONTROL_MESSAGE.SUBSCRIBE, controlReader);
    return { subscribeId, trackAlias, namespace, trackName, subscriberPriority, groupOrder, filterType, startGroup, startObject, endGroup, parameters };
};
