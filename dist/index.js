import { MOQ_DRAFT04_VERSION, MOQ_MAX_PARAMS, MOQ_MESSAGE, MOQ_PARAMETER_AUTHORIZATION_INFO, MOQ_PARAMETER_ROLE, OBJECT_STATUS, SUBSCRIBE_FILTER } from './constants';
export * from './constants';
import { TrackManager } from './track';
import { numberToVarInt, concatBuffer, varIntToNumber, buffRead, stringToBytes, toString } from './utils/bytes';
export * as moqtBytes from './utils/bytes';
export class MOQT {
    constructor(props) {
        this.MAX_INFLIGHT_REQUESTS = 50;
        this.senderState = {};
        this.inflightRequests = [];
        this.wt = new WebTransport(props.url, { congestionControl: 'throughput' }); // 'throughput' or 'low-latency' although only Firefox supports 'low-latency'
        this.trackManager = new TrackManager();
        if (props.maxInflightRequests)
            this.MAX_INFLIGHT_REQUESTS = props.maxInflightRequests;
    }
    async initControlStream() {
        await this.wt.ready;
        this.controlStream = await this.wt.createBidirectionalStream();
        this.controlWriter = this.controlStream.writable;
        this.controlReader = this.controlStream.readable;
    }
    getIncomingStream() { return this.wt.incomingUnidirectionalStreams; }
    async send(props) {
        const writer = props.writerStream.getWriter();
        await writer.write(props.dataBytes);
        writer.releaseLock();
    }
    // read message type
    async readControlMessageType() {
        return await varIntToNumber(this.controlReader);
    }
    // SETUP
    generateSetupMessage(props) {
        const messageType = numberToVarInt(MOQ_MESSAGE.CLIENT_SETUP);
        const versionLength = numberToVarInt(1);
        const version = numberToVarInt(MOQ_DRAFT04_VERSION);
        const numberOfParams = numberToVarInt(1);
        const roleParamId = numberToVarInt(MOQ_PARAMETER_ROLE.KEY);
        const roleParamData = numberToVarInt(props.role);
        const roleParamRoleLength = numberToVarInt(roleParamData.byteLength);
        return concatBuffer([messageType, versionLength, version, numberOfParams, roleParamId, roleParamRoleLength, roleParamData]);
    }
    async setup(props) {
        const setup = this.generateSetupMessage(props);
        await this.send({ writerStream: this.controlWriter, dataBytes: setup });
    }
    async readSetup() {
        const ret = { version: 0, parameters: null };
        const type = await varIntToNumber(this.controlReader);
        if (type !== MOQ_MESSAGE.SERVER_SETUP) {
            throw new Error(`SETUP answer with type ${type} is not supported`);
        }
        ret.version = await varIntToNumber(this.controlReader);
        ret.parameters = await this.readParams();
        return ret;
    }
    // ANNOUNCE
    generateAnnounceMessage(props) {
        const messageType = numberToVarInt(MOQ_MESSAGE.ANNOUNCE);
        const namespace = stringToBytes(props.namespace);
        const numberOfParams = numberToVarInt(1);
        const authInfoIdBytes = numberToVarInt(MOQ_PARAMETER_AUTHORIZATION_INFO);
        const authInfoBytes = stringToBytes(props.authInfo);
        return concatBuffer([messageType, namespace, numberOfParams, authInfoIdBytes, authInfoBytes]);
    }
    async announce(props) {
        const announce = this.generateAnnounceMessage(props);
        await this.send({ writerStream: this.controlWriter, dataBytes: announce });
    }
    async readAnnounce() {
        const type = await varIntToNumber(this.controlReader);
        if (type !== MOQ_MESSAGE.ANNOUNCE_OK) {
            throw new Error(`ANNOUNCE answer type must be ${MOQ_MESSAGE.ANNOUNCE_OK}, got ${type}`);
        }
        const namespace = await toString(this.controlReader);
        return { namespace };
    }
    generateUnannounceMessage(ns) {
        const messageType = numberToVarInt(MOQ_MESSAGE.UNANNOUNCE);
        const namespace = stringToBytes(ns);
        return concatBuffer([messageType, namespace]);
    }
    async unannounce() {
        const unannounce = this.generateUnannounceMessage('kota');
        await this.send({ writerStream: this.controlWriter, dataBytes: unannounce });
    }
    // TODO: announce ok, announce error, announce cancel and unannounce
    // TODO: track status request, track status
    // SUBSCRIBE
    generateSubscribeMessage(props) {
        const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE);
        const subscribeIdBytes = numberToVarInt(props.subscribeId);
        const trackAliasBytes = numberToVarInt(props.subscribeId); // temporary value
        const namespaceBytes = stringToBytes(props.namespace);
        const trackNameBytes = stringToBytes(props.trackName);
        // const subscriberPriorityBytes = numberToVarInt(1); // temporary constant
        const filterTypeBytes = numberToVarInt(SUBSCRIBE_FILTER.LATEST_OBEJCT); // temporary constant
        // const groupOrderBytes = numberToVarInt(SUBSCRIBE_GROUP_ORDER.ASCENDING); // temporary constant prob v5
        // const startGroupBytesValue = numberToVarInt(0);
        // const startObjectBytesValue = numberToVarInt(0);
        // const endGroupBytesValue
        // const endObjectBytesValue
        const numberOfParamsBytes = numberToVarInt(1);
        const authInfoParamIdBytes = numberToVarInt(MOQ_PARAMETER_AUTHORIZATION_INFO);
        const authInfoBytes = stringToBytes(props.authInfo);
        return concatBuffer([messageTypeBytes, subscribeIdBytes, trackAliasBytes, namespaceBytes, trackNameBytes, filterTypeBytes, numberOfParamsBytes, authInfoParamIdBytes, authInfoBytes]);
    }
    async subscribe(props) {
        const subscribe = this.generateSubscribeMessage(props);
        await this.send({ writerStream: this.controlWriter, dataBytes: subscribe });
    }
    async readSubscribe() {
        const ret = { subscribeId: -1, trackAlias: -1, namespace: '', trackName: '', filterType: -1, startGroup: -1, startObject: -1, endGroup: -1, endObject: -1, parameters: null };
        ret.subscribeId = await varIntToNumber(this.controlReader);
        ret.trackAlias = await varIntToNumber(this.controlReader);
        ret.namespace = await toString(this.controlReader);
        ret.trackName = await toString(this.controlReader);
        ret.filterType = await varIntToNumber(this.controlReader);
        // ret.startGroup = await varIntToNumber(this.controlReader);
        // if (ret.startGroup !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
        // ret.startObject = await varIntToNumber(this.controlReader);
        // if (ret.startObject !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
        // ret.endGroup = await varIntToNumber(this.controlReader);
        // if (ret.endGroup !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
        // ret.endObject = await varIntToNumber(this.controlReader);
        // if (ret.endObject !== MOQ_LOCATION_MODE_NONE) await varIntToNumber(this.controlReader);
        ret.parameters = await this.readParams();
        return ret;
    }
    generateSubscribeResponseMessage(props) {
        const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE_OK);
        const subscriptionIdBytes = numberToVarInt(props.subscribeId);
        const expiresBytes = numberToVarInt(props.expiresMs);
        const contentExistsBytes = numberToVarInt(1); // temporary constant
        const largestGroupIdBytes = numberToVarInt(0); // temporary constant
        const largestObjectIdBytes = numberToVarInt(0); // temporary constant
        return concatBuffer([messageTypeBytes, subscriptionIdBytes, expiresBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes]);
    }
    async sendSubscribeResponse(props) {
        const subscribeResponse = this.generateSubscribeResponseMessage(props);
        await this.send({ writerStream: this.controlWriter, dataBytes: subscribeResponse });
    }
    async readSubscribeResponse() {
        const ret = { subscribeId: -1, expires: -1, contentExists: -1 };
        ret.subscribeId = await varIntToNumber(this.controlReader);
        ret.expires = await varIntToNumber(this.controlReader);
        ret.contentExists = await varIntToNumber(this.controlReader);
        return ret;
    }
    generateSubscribeUpdateMessage() { }
    async readSubscribeError() {
        const subscribeId = await varIntToNumber(this.controlReader);
        const errorCode = await varIntToNumber(this.controlReader);
        const reasonPhrase = await toString(this.controlReader);
        const trackAlias = await varIntToNumber(this.controlReader);
        return { subscribeId, errorCode, reasonPhrase, trackAlias };
    }
    readSubscribeDone() { }
    generateUnsubscribeMessage(subscribeId) {
        const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.UNSUBSCRIBE);
        const subscribeIdBytes = numberToVarInt(subscribeId);
        return concatBuffer([messageTypeBytes, subscribeIdBytes]);
    }
    async unsubscribe(subscribeId) {
        const unsubscribeMessage = this.generateUnsubscribeMessage(subscribeId);
        await this.send({ writerStream: this.controlWriter, dataBytes: unsubscribeMessage });
    }
    async readUnsubscribe() {
        const subscribeId = await varIntToNumber(this.controlReader);
        return { subscribeId };
    }
    // OBJECT
    generateObjectMessage(props) {
        const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.OBJECT_STREAM);
        const subscribeIdBytes = numberToVarInt(props.subscribeId);
        const trackAliasBytes = numberToVarInt(props.subscribeId); // temporary value
        const groupIdBytes = numberToVarInt(props.groupSeq);
        const objectIdBytes = numberToVarInt(props.objectSeq);
        const sendOrderBytes = numberToVarInt(props.sendOrder);
        const objectStatusBytes = numberToVarInt(OBJECT_STATUS.NORMAL);
        const performanceBytes = numberToVarInt(Math.floor(performance.timeOrigin + performance.now()));
        return {
            getId: () => `${props.subscribeId}-${props.groupSeq}-${props.objectSeq}`,
            toBytes: () => concatBuffer([messageTypeBytes, subscribeIdBytes, trackAliasBytes, groupIdBytes, objectIdBytes, sendOrderBytes, objectStatusBytes, performanceBytes, props.data])
        };
    }
    async sendObject(props) {
        const targetTrack = this.trackManager.getTrack(props.trackName);
        if (!this.senderState[props.trackName]) {
            this.senderState[props.trackName] = {
                currentGroupSeq: 0,
                currentObjectSeq: 0,
            };
        }
        else {
            this.senderState[props.trackName].currentObjectSeq++;
        }
        if (props.newGroup) {
            this.senderState[props.trackName].currentGroupSeq++;
            this.senderState[props.trackName].currentObjectSeq = 0;
        }
        const sendOrder = (this.senderState[props.trackName].currentObjectSeq + 1) * targetTrack.priority; // Really temporary
        const uniStream = await this.wt.createUnidirectionalStream({ sendOrder });
        for (const subscribeId of targetTrack.subscribeIds) {
            const moqtObject = this.generateObjectMessage({
                subscribeId,
                groupSeq: this.senderState[props.trackName].currentGroupSeq,
                objectSeq: this.senderState[props.trackName].currentObjectSeq,
                sendOrder,
                data: props.data
            });
            const success = this.addInflightRequest(moqtObject.getId());
            if (success.success) {
                await this.send({ writerStream: uniStream, dataBytes: moqtObject.toBytes() });
                uniStream.close().finally(() => {
                    this.removeInflightRequest(moqtObject.getId());
                });
            }
        }
    }
    async readObject(props) {
        const type = await varIntToNumber(props.readableStream);
        if (type !== MOQ_MESSAGE.OBJECT_STREAM && type !== MOQ_MESSAGE.OBJECT_DATAGRAM) {
            throw new Error(`OBJECT answer type must be ${MOQ_MESSAGE.OBJECT_STREAM} or ${MOQ_MESSAGE.OBJECT_DATAGRAM}, got ${type}`);
        }
        const subscribeId = await varIntToNumber(props.readableStream);
        const trackAlias = await varIntToNumber(props.readableStream);
        const groupId = await varIntToNumber(props.readableStream);
        const objId = await varIntToNumber(props.readableStream);
        const sendOrder = await varIntToNumber(props.readableStream);
        const objectStatus = await varIntToNumber(props.readableStream);
        const sourcePerformance = await varIntToNumber(props.readableStream);
        return { subscribeId, trackAlias, groupId, objId, sendOrder, objectStatus };
    }
    // TODO: OBJECT DATAGRAM, Multi-Object Streams, track status request, track status
    async readParams() {
        const ret = { authInfo: '', role: -1 };
        const numParams = await varIntToNumber(this.controlReader);
        if (numParams > MOQ_MAX_PARAMS) {
            throw new Error(`exceeded the max number of supported params ${MOQ_MAX_PARAMS}, got ${numParams}`);
        }
        for (let i = 0; i < numParams; i++) {
            const paramId = await varIntToNumber(this.controlReader);
            if (paramId === MOQ_PARAMETER_AUTHORIZATION_INFO) {
                ret.authInfo = await toString(this.controlReader);
                break;
            }
            else if (paramId === MOQ_PARAMETER_ROLE) {
                await varIntToNumber(this.controlReader);
                ret.role = await varIntToNumber(this.controlReader);
            }
            else {
                const paramLength = await varIntToNumber(this.controlReader);
                const skip = await buffRead(this.controlReader, paramLength);
                ret[`unknown-${i}-${paramId}-${paramLength}`] = JSON.stringify(skip);
            }
        }
        return ret;
    }
    addInflightRequest(requestId) {
        if (this.inflightRequests.length > this.MAX_INFLIGHT_REQUESTS) {
            return { success: false };
        }
        this.inflightRequests.push(requestId);
        return { success: true };
    }
    removeInflightRequest(requestId) {
        this.inflightRequests = this.inflightRequests.filter((id) => id !== requestId);
    }
}
