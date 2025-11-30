import { concatUint8Arrays, getUint8, serializeQuicVarInt, setUint8, deserializeQuicVarInt, getQuicVarIntLength } from "bytes";
import { deserializeExtensionHeader, serializeExtensionHeaders } from "./extensionHeader";
import type { ExtensionHeader } from "./extensionHeader";
import { ObjectValueList } from "internal";

/** Read the datagram type discriminator. */
export const deserializeDatagramType = async (readableStream: ReadableStream): Promise<DATAGRAM_TYPE> => {
  return await deserializeQuicVarInt(readableStream);
}

/** Serialize a datagram header plus payload. */
export const serializeDatagram = (props: Datagram) => {
  const typeBytes = serializeQuicVarInt(props.type);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const groupIdBytes = serializeQuicVarInt(props.groupId);
  const objectIdBytes = serializeQuicVarInt(props.objectId);
  const publisherPriorityBytes = setUint8(props.publisherPriority);
  let extensionHeaderBytes = new Uint8Array(0);
  if (props.type === DATAGRAM_TYPE.DATAGRAM_WITH_EXTENSION) {
    extensionHeaderBytes = serializeExtensionHeaders(props.extensionHeaders);
  }
  const datagram = concatUint8Arrays([typeBytes, trackAliasBytes, groupIdBytes, objectIdBytes, publisherPriorityBytes, extensionHeaderBytes, props.payload]);
  return datagram;
}

/** Deserialize only the datagram header fields from a stream. */
export const deserializeDatagramHeader = async (type: DATAGRAM_TYPE, readableStream: ReadableStream): Promise<Datagram> => {
  const ret: Datagram = {} as Datagram;
  ret.type = type;
  ret.trackAlias = await deserializeQuicVarInt(readableStream);
  ret.groupId = await deserializeQuicVarInt(readableStream);
  ret.objectId = await deserializeQuicVarInt(readableStream);
  ret.publisherPriority = await getUint8(readableStream)
  ret.extensionHeaders = [];
  if (ret.type === DATAGRAM_TYPE.DATAGRAM_WITHOUT_EXTENSION) return ret;
  let extensionHeadersLength = await deserializeQuicVarInt(readableStream);
  ret.extensionHeaders = [];
  while (extensionHeadersLength > 0) {
    const v = await deserializeExtensionHeader(readableStream);
    ret.extensionHeaders.push(v.value);
    extensionHeadersLength -= v.byteLength;
  }
  return ret;
}

/** Datagram type values as defined by the MOQT draft. */
export const DATAGRAM_TYPE = {
  DATAGRAM_WITHOUT_EXTENSION: 0x0,
  DATAGRAM_WITH_EXTENSION: 0x1,
  DATAGRAM_STATUS_WITHOUT_EXTENSION: 0x2,
  DATAGRAM_STATUS_WITH_EXTENSION: 0x3,
}
export type DATAGRAM_TYPE = ObjectValueList<typeof DATAGRAM_TYPE>;

/** Datagram header fields plus payload. */
export interface Datagram {
  type: DATAGRAM_TYPE,
  trackAlias: number,
  groupId: number,
  objectId: number,
  publisherPriority: number,
  extensionHeaders: ExtensionHeader[],
  payload: Uint8Array
};
