import type { OBJECT_STATUS } from "../constants";
import { concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";
import { deserializeExtensionHeader, serializeExtensionHeaders, type ExtensionHeader } from "./extensionHeader";

/** Serialize a subgroup object header and payload. */
export const serializeSubgroupObject = (props: SubgroupObject) => {
  const objectIdBytes = serializeQuicVarInt(props.objectId);
  const extensionHeaderBytes = serializeExtensionHeaders(props.extensionHeaders); // assuming subgroup header's type is **_WITH_EXTENSION
  const payloadLengthBytes = serializeQuicVarInt(props.payload.byteLength);
  let objectStatusBytes = new Uint8Array(0);
  if (props.payload.byteLength === 0) {
    if (props.objectStatus === undefined) throw new Error('objectStatus is required when payload is empty');
    objectStatusBytes = serializeQuicVarInt(props.objectStatus);
  }
  return concatUint8Arrays([objectIdBytes, extensionHeaderBytes, payloadLengthBytes, objectStatusBytes, props.payload]);
};

/** Deserialize only the subgroup object header from a stream. */
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

/** Subgroup object header fields and payload. */
export interface SubgroupObject {
  objectId: number,
  extensionHeaders: ExtensionHeader[],
  objectStatus?: OBJECT_STATUS
  payload: Uint8Array
}
