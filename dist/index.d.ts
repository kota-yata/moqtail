export * from './constants';
import { TrackManager } from './track';
export declare class MOQT {
    private MAX_INFLIGHT_REQUESTS;
    private wt;
    private controlStream;
    private controlWriter;
    private controlReader;
    private senderState;
    private inflightRequests;
    trackManager: TrackManager;
    constructor(props: {
        url: string;
        maxInflightRequests?: number;
    });
    initControlStream(): Promise<void>;
    getIncomingStream(): ReadableStream;
    private send;
    readControlMessageType(): Promise<number>;
    private generateSetupMessage;
    setup(props: {
        role: number;
    }): Promise<void>;
    readSetup(): Promise<{
        version: number;
        parameters: any;
    }>;
    private generateAnnounceMessage;
    announce(props: {
        namespace: string;
        authInfo: string;
    }): Promise<void>;
    readAnnounce(): Promise<{
        namespace: string;
    }>;
    generateUnannounceMessage(ns: string): Uint8Array;
    unannounce(): Promise<void>;
    private generateSubscribeMessage;
    subscribe(props: {
        subscribeId: number;
        namespace: string;
        trackName: string;
        authInfo: string;
    }): Promise<void>;
    readSubscribe(): Promise<{
        subscribeId: number;
        trackAlias: number;
        namespace: string;
        trackName: string;
        filterType: number;
        startGroup: number;
        startObject: number;
        endGroup: number;
        endObject: number;
        parameters: any;
    }>;
    private generateSubscribeResponseMessage;
    sendSubscribeResponse(props: {
        subscribeId: number;
        expiresMs: number;
    }): Promise<void>;
    readSubscribeResponse(): Promise<{
        subscribeId: number;
        expires: number;
        contentExists: number;
    }>;
    private generateSubscribeUpdateMessage;
    readSubscribeError(): Promise<{
        subscribeId: any;
        errorCode: any;
        reasonPhrase: string;
        trackAlias: any;
    }>;
    readSubscribeDone(): void;
    private generateUnsubscribeMessage;
    unsubscribe(subscribeId: number): Promise<void>;
    readUnsubscribe(): Promise<{
        subscribeId: any;
    }>;
    private generateObjectMessage;
    sendObject(props: {
        trackName: string;
        data: Uint8Array;
        newGroup: boolean;
    }): Promise<void>;
    readObject(props: {
        readableStream: ReadableStream;
    }): Promise<{
        subscribeId: any;
        trackAlias: any;
        groupId: any;
        objId: any;
        sendOrder: any;
        objectStatus: any;
    }>;
    private readParams;
    private addInflightRequest;
    private removeInflightRequest;
}
