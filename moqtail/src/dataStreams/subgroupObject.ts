import type { OBJECT_STATUS } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";
import { deserializeExtensionHeader, serializeExtensionHeader, serializeExtensionHeaders, type ExtensionHeader } from "./extensionHeader";

export const serializeSubgroupObject = (props: SubgroupObject) => {
  const objectIdBytes = serializeQuicVarInt(props.objectId);
  const extensionHeaderBytes = serializeExtensionHeaders(props.extensionHeaders);
  const payloadLengthBytes = serializeQuicVarInt(props.payload.byteLength);
  let objectStatusBytes = new Uint8Array(0);
  if (props.payload.byteLength === 0) {
    if (props.objectStatus === undefined) throw new Error('objectStatus is required when payload is empty');
    objectStatusBytes = serializeQuicVarInt(props.objectStatus);
  }
  return concatUint8Arrays([objectIdBytes, extensionHeaderBytes, payloadLengthBytes, objectStatusBytes, props.payload]);
};

export const deserializeSubgroupObjectHeader = async (readableStream: ReadableStream): Promise<SubgroupObject> => {
  const ret: SubgroupObject = {} as SubgroupObject;
  ret.objectId = await deserializeQuicVarInt(readableStream);
  let extensionHeadersLength = await deserializeQuicVarInt(readableStream);
  ret.extensionHeaders = [];
  while (extensionHeadersLength > 0) {
    const v = await deserializeExtensionHeader(readableStream);
    ret.extensionHeaders.push(v.value);
    extensionHeadersLength -= v.byteLength;
  }
  const payloadLength = await deserializeQuicVarInt(readableStream);
  if (payloadLength === 0) {
    ret.objectStatus = await deserializeQuicVarInt(readableStream) as OBJECT_STATUS;
  }
  return ret;
};

export interface SubgroupObject {
  objectId: number,
  extensionHeaders: ExtensionHeader[],
  objectStatus?: OBJECT_STATUS
  payload: Uint8Array
}
