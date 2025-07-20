import { DATAGRAM } from "../constants";
import { concatUint8Arrays, getUint8, serializeQuicVarInt, setUint8, deserializeQuicVarInt, getQuicVarIntLength } from "bytes";
import { deserializeExtensionHeader, serializeExtensionHeaders } from "./extensionHeader";
import type { ExtensionHeader } from "./extensionHeader";

export const deserializeDatagramType = async (readableStream: ReadableStream): Promise<number> => {
  return await deserializeQuicVarInt(readableStream);
}

export const serializeDatagram = (props: Datagram) => {
  const typeBytes = serializeQuicVarInt(props.extensionHeaders.length > 0 ? DATAGRAM_TYPE.WITH_EXTENSION : DATAGRAM_TYPE.WITHOUT_EXTENSION);
  const trackAliasBytes = serializeQuicVarInt(props.trackAlias);
  const groupIdBytes = serializeQuicVarInt(props.groupId);
  const objectIdBytes = serializeQuicVarInt(props.objectId);
  const publisherPriorityBytes = setUint8(props.publisherPriority);
  const extensionHeaderBytes = serializeExtensionHeaders(props.extensionHeaders);
  console.log(`Serialized Datagram: Type=${typeBytes}, TrackAlias=${trackAliasBytes}, GroupId=${groupIdBytes}, ObjectId=${objectIdBytes}, PublisherPriority=${publisherPriorityBytes}, ExtensionHeaders=${extensionHeaderBytes}`);
  const datagram = concatUint8Arrays([typeBytes, trackAliasBytes, groupIdBytes, objectIdBytes, publisherPriorityBytes, extensionHeaderBytes, props.payload]);
  return datagram;
}

export const deserializeDatagramHeader = async (readableStream: ReadableStream): Promise<Datagram> => {
  const ret: Datagram = {} as Datagram;
  const type = await deserializeQuicVarInt(readableStream) as DATAGRAM_TYPE;
  ret.trackAlias = await deserializeQuicVarInt(readableStream);
  ret.groupId = await deserializeQuicVarInt(readableStream);
  ret.objectId = await deserializeQuicVarInt(readableStream);
  ret.publisherPriority = await getUint8(readableStream)
  console.log(`Deserialized Datagram Header: Type=${type}, TrackAlias=${ret.trackAlias}, GroupId=${ret.groupId}, ObjectId=${ret.objectId}, PublisherPriority=${ret.publisherPriority}`);
  ret.extensionHeaders = [];
  if (type === DATAGRAM_TYPE.WITHOUT_EXTENSION) return ret;
  let extensionHeadersLength = await deserializeQuicVarInt(readableStream);
  ret.extensionHeaders = [];
  while (extensionHeadersLength > 0) {
    const v = await deserializeExtensionHeader(readableStream);
    console.log(`Deserialized Extension Header: ${v.value.type} - ${v.value.value}`);
    ret.extensionHeaders.push(v.value);
    extensionHeadersLength -= v.byteLength;
  }
  return ret;
}

export const DATAGRAM_TYPE = {
  WITHOUT_EXTENSION: 0x0,
  WITH_EXTENSION: 0x1,
}
export type DATAGRAM_TYPE = ObjectValueList<typeof DATAGRAM_TYPE>;

export interface Datagram {
  trackAlias: number,
  groupId: number,
  objectId: number,
  publisherPriority: number,
  extensionHeaders: ExtensionHeader[],
  payload: Uint8Array
};
