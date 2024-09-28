// TODO:
// OBJECT_DATAGRAM
// STREAM_HEADER_TRACK
// STREAM_HEADER_GROUP
import { MOQ_DRAFT04_VERSION, MOQ_MAX_PARAMS, MOQ_MESSAGE, MOQ_PARAMETER_AUTHORIZATION_INFO, MOQ_PARAMETER_ROLE, OBJECT_STATUS, SUBSCRIBE_FILTER, TRACK_STATUS_CODE } from './constants';
export * from './constants';
import { TrackManager } from './track';
import { numberToVarInt, concatBuffer, varIntToNumber, buffRead, stringToBytes, toString } from './utils/bytes';
export * as moqtBytes from './utils/bytes';

interface SenderState {
  [key: string]: {
    currentGroupSeq: number,
    currentObjectSeq: number,
  }
}

export class MOQT {
  private MAX_INFLIGHT_REQUESTS = 50;
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;
  private senderState: SenderState = {};
  private inflightRequests: string[] = [];
  public trackManager: TrackManager;
  constructor(props: { url: string, maxInflightRequests?: number }) {
    this.wt = new WebTransport(props.url, { congestionControl: 'throughput' }); // 'throughput' or 'low-latency' although only Firefox supports 'low-latency'
    this.trackManager = new TrackManager();
    if (props.maxInflightRequests) this.MAX_INFLIGHT_REQUESTS = props.maxInflightRequests;
  }
  public async initControlStream() {
    await this.wt.ready;
    this.controlStream = await this.wt.createBidirectionalStream();
    this.controlWriter = this.controlStream.writable;
    this.controlReader = this.controlStream.readable;
  }
  
  public getIncomingStream(): ReadableStream { return this.wt.incomingUnidirectionalStreams; }
  private async send(props: { writerStream: WritableStream, dataBytes: Uint8Array }) {
    const writer = props.writerStream.getWriter();
    await writer.write(props.dataBytes);
    writer.releaseLock();
  }
  public async readControlMessageType(): Promise<number> {
    return await varIntToNumber(this.controlReader);
  }
  // SETUP
  private generateSetupMessage(props: { role: number }) {
    const messageType = numberToVarInt(MOQ_MESSAGE.CLIENT_SETUP);
    const versionLength = numberToVarInt(1);
    const version = numberToVarInt(MOQ_DRAFT04_VERSION);
    const numberOfParams = numberToVarInt(1);
    const roleParamId = numberToVarInt(MOQ_PARAMETER_ROLE.KEY);
    const roleParamData = numberToVarInt(props.role);
    const roleParamRoleLength = numberToVarInt(roleParamData.byteLength);
    return concatBuffer([messageType, versionLength, version, numberOfParams, roleParamId, roleParamRoleLength, roleParamData]);
  }
  public async setup(props: { role: number }) {
    const setup = this.generateSetupMessage(props);
    await this.send({writerStream: this.controlWriter, dataBytes: setup});
  }
  public async readServerSetup() {
    const version = await varIntToNumber(this.controlReader);
    const parameters = await this.readParams();
    return { version, parameters };
  }
  // ANNOUNCE
  private generateAnnounceMessage(props: { namespace: string, authInfo: string }) {
    const messageType = numberToVarInt(MOQ_MESSAGE.ANNOUNCE);
    const namespace = stringToBytes(props.namespace);
    const numberOfParams = numberToVarInt(1);
    const authInfoIdBytes = numberToVarInt(MOQ_PARAMETER_AUTHORIZATION_INFO);
    const authInfoBytes = stringToBytes(props.authInfo);
    return concatBuffer([messageType, namespace, numberOfParams, authInfoIdBytes, authInfoBytes]);
  }
  public async announce(props: { namespace: string, authInfo: string }) {
    const announce = this.generateAnnounceMessage(props);
    await this.send({writerStream: this.controlWriter, dataBytes: announce});
  }
  public async readAnnounce() {
    const namespace = await toString(this.controlReader);
    return { namespace };
  }
  public readAnnouceOk() {
    const namespace = toString(this.controlReader);
    return { namespace };
  }
  public readAnnounceError() {
    const namespace = toString(this.controlReader);
    const errorCode = varIntToNumber(this.controlReader);
    const reasonPhrase = toString(this.controlReader);
    return { namespace, errorCode, reasonPhrase };
  }
  public readAnnounceCancel() {
    const namespace = toString(this.controlReader);
    return { namespace };
  }
  public generateUnannounceMessage(ns: string) {
    const messageType = numberToVarInt(MOQ_MESSAGE.UNANNOUNCE);
    const namespace = stringToBytes(ns);
    return concatBuffer([messageType, namespace]);
  }
  public async unannounce() {
    const unannounce = this.generateUnannounceMessage('kota');
    await this.send({writerStream: this.controlWriter, dataBytes: unannounce});
  }
  public async readUnannounce() {
    const namespace = await toString(this.controlReader);
    return { namespace };
  }
  // SUBSCRIBE
  private generateSubscribeMessage(props: {subscribeId: number, namespace: string, trackName: string, authInfo: string}) {
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
  public async subscribe(props: {subscribeId: number, namespace: string, trackName: string, authInfo: string }) {
    const subscribe = this.generateSubscribeMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: subscribe });
  }
  public async readSubscribe() {
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
  private generateSubscribeOkMessage(props: {subscribeId: number, expiresMs: number }) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.SUBSCRIBE_OK);
    const subscriptionIdBytes = numberToVarInt(props.subscribeId);
    const expiresBytes = numberToVarInt(props.expiresMs);
    const contentExistsBytes = numberToVarInt(1); // temporary constant
    const largestGroupIdBytes = numberToVarInt(0); // temporary constant
    const largestObjectIdBytes = numberToVarInt(0); // temporary constant
    return concatBuffer([messageTypeBytes, subscriptionIdBytes, expiresBytes, contentExistsBytes, largestGroupIdBytes, largestObjectIdBytes]);
  }
  public async sendSubscribeOk(props: {subscribeId: number, expiresMs: number }) {
    const SubscribeOk = this.generateSubscribeOkMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: SubscribeOk });
  }
  public async readSubscribeOk() {
    const ret = { subscribeId: -1, expires: -1, contentExists: -1 };
    ret.subscribeId = await varIntToNumber(this.controlReader);
    ret.expires = await varIntToNumber(this.controlReader);
    ret.contentExists = await varIntToNumber(this.controlReader);
    return ret;
  }
  public async readSubscribeError() {
    const subscribeId = await varIntToNumber(this.controlReader);
    const errorCode = await varIntToNumber(this.controlReader);
    if (errorCode < 0x0 || errorCode > 0x2) throw new Error(`Invalid Subscribe Error Code: ${errorCode}`);
    const reasonPhrase = await toString(this.controlReader);
    const trackAlias = await varIntToNumber(this.controlReader);
    return { subscribeId, errorCode, reasonPhrase, trackAlias };
  }
  public async readSubscribeDone() {
    const subscribeId = await varIntToNumber(this.controlReader);
    const statusCode = await varIntToNumber(this.controlReader);
    if (statusCode < 0x0 || statusCode > 0x6) throw new Error(`Invalid Subscribe Done Status Code: ${statusCode}`);
    const reasonPhrase = await toString(this.controlReader);
    const contentExists = await varIntToNumber(this.controlReader); // need specific func for reading flags??
    if (contentExists !== 0x1) return { subscribeId, statusCode, reasonPhrase, contentExists };
    const finalGroupId = await varIntToNumber(this.controlReader);
    const finalObjectId = await varIntToNumber(this.controlReader);
    return { subscribeId, statusCode, reasonPhrase, contentExists, finalGroupId, finalObjectId };
  }
  private generateUnsubscribeMessage(subscribeId: number) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.UNSUBSCRIBE);
    const subscribeIdBytes = numberToVarInt(subscribeId);
    return concatBuffer([messageTypeBytes, subscribeIdBytes]);
  }
  public async unsubscribe(subscribeId: number) {
    const unsubscribeMessage = this.generateUnsubscribeMessage(subscribeId);
    await this.send({ writerStream: this.controlWriter, dataBytes: unsubscribeMessage });
  }
  public async readUnsubscribe () {
    const subscribeId = await varIntToNumber(this.controlReader);
    return { subscribeId };
  }
  // TRACK_STATUS
  private generateTrackStatusRequestMessage(props: { namespace: string, trackName: string }) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.TRACK_STATUS_REQUEST);
    const namespaceBytes = stringToBytes(props.namespace);
    const trackNameBytes = stringToBytes(props.trackName);
    return concatBuffer([messageTypeBytes, namespaceBytes, trackNameBytes]);
  }
  public async trackStatusRequest(props: { namespace: string, trackName: string }) {
    const trackStatusRequest = this.generateTrackStatusRequestMessage(props);
    await this.send({ writerStream: this.controlWriter, dataBytes: trackStatusRequest });
  }
  public async readTrackStatusRequest() {
    const namespace = await toString(this.controlReader);
    const trackName = await toString(this.controlReader);
    return { namespace, trackName };
  }
  private generateTrackStatusMessage(props: { namespace: string, trackName: string, status: number, lastGroupId: number, lastObjectId: number }) {
    const messageTypeBytes = numberToVarInt(MOQ_MESSAGE.TRACK_STATUS);
    const namespaceBytes = stringToBytes(props.namespace);
    const trackNameBytes = stringToBytes(props.trackName);
    const statusBytes = numberToVarInt(props.status);
    const lastGroupId = numberToVarInt(props.lastGroupId);
    const lastObjectId = numberToVarInt(props.lastObjectId);
    return concatBuffer([messageTypeBytes, namespaceBytes, trackNameBytes, statusBytes, lastGroupId, lastObjectId]);
  }
  public trackStatus(props: { namespace: string, trackName: string, status: number }) {
    let lastGroupId = 0
    let lastObjectId = 0
    if (props.status !== TRACK_STATUS_CODE.NOT_BEGUN && props.status !== TRACK_STATUS_CODE.NOT_EXIST ) {
      lastGroupId = this.senderState[props.trackName].currentGroupSeq;
      lastObjectId = this.senderState[props.trackName].currentObjectSeq;
    }
    const trackStatus = this.generateTrackStatusMessage({ ...props, lastGroupId, lastObjectId });
    this.send({ writerStream: this.controlWriter, dataBytes: trackStatus });
  }
  public async readTrackStatus() {
    const namespace = await toString(this.controlReader);
    const trackName = await toString(this.controlReader);
    const status = await varIntToNumber(this.controlReader);
    const lastGroupId = await varIntToNumber(this.controlReader);
    const lastObjectId = await varIntToNumber(this.controlReader);
    return { namespace, trackName, status, lastGroupId, lastObjectId };
  }
  // OBJECT
  private generateObjectStreamMessage(props: {subscribeId: number, groupSeq: number, objectSeq: number, sendOrder: number, data: Uint8Array}) {
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
  public async sendObjectStream(props: { trackName: string, data: Uint8Array, newGroup: boolean }) {
    const targetTrack = this.trackManager.getTrack(props.trackName);
    if (!this.senderState[props.trackName]) {
      this.senderState[props.trackName] = {
        currentGroupSeq: 0,
        currentObjectSeq: 0,
      };
    } else {
      this.senderState[props.trackName].currentObjectSeq++;
    }
    if (props.newGroup) {
      this.senderState[props.trackName].currentGroupSeq++;
      this.senderState[props.trackName].currentObjectSeq = 0;
    }
    const sendOrder = (this.senderState[props.trackName].currentObjectSeq + 1) * targetTrack.priority; // Really temporary
    const uniStream = await this.wt.createUnidirectionalStream({ sendOrder });
    for (const subscribeId of targetTrack.subscribeIds) {
      const moqtObject = this.generateObjectStreamMessage({
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
  public async readObjectStream(props: { readableStream: ReadableStream }) {
    const subscribeId = await varIntToNumber(props.readableStream);
    const trackAlias = await varIntToNumber(props.readableStream);
    const groupId = await varIntToNumber(props.readableStream);
    const objId = await varIntToNumber(props.readableStream);
    const sendOrder = await varIntToNumber(props.readableStream);
    const objectStatus = await varIntToNumber(props.readableStream);
    return { subscribeId, trackAlias, groupId, objId, sendOrder, objectStatus };
  }
  public async readGoAway() {
    const newSessionUri = await toString(this.controlReader);
    return { newSessionUri };
  }
  private async readParams() {
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
      } else if (paramId === MOQ_PARAMETER_ROLE) {
        await varIntToNumber(this.controlReader);
        ret.role = await varIntToNumber(this.controlReader);
      } else {
        const paramLength = await varIntToNumber(this.controlReader);
        const skip = await buffRead(this.controlReader, paramLength);
        ret[`unknown-${i}-${paramId}-${paramLength}`] = JSON.stringify(skip);
      }
    }
    return ret;
  }
  private addInflightRequest(requestId: string): { success: boolean } {
    if (this.inflightRequests.length > this.MAX_INFLIGHT_REQUESTS) {
      return { success: false };
    }
    this.inflightRequests.push(requestId);
    return { success: true };
  }
  private removeInflightRequest(requestId: string) {
    this.inflightRequests = this.inflightRequests.filter((id) => id !== requestId);
  }
}
