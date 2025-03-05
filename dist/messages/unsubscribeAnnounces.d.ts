export declare const serializeUnsubscribeAnnounces: (trackNamespacePrefix: string[]) => Uint8Array;
export declare const deserializeUnsubscribeAnnounces: (controlReader: ReadableStream) => Promise<{
    trackNamespacePrefix: string[];
}>;
