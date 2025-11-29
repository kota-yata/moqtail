import { serializeQuicVarInt, deserializeQuicVarInt, concatUint8Arrays } from 'bytes';

/**
 * Logical identifier for a MOQT object within a group.
 */
export interface Location {
  /** Group identifier. */
  group: number;
  /** Object identifier within the group. */
  object: number;
}

/**
 * Serialize a `Location` to varint-encoded bytes.
 */
export const serializeLocation = (location: Location): Uint8Array => {
  const groupBytes = serializeQuicVarInt(location.group);
  const objectBytes = serializeQuicVarInt(location.object);
  return concatUint8Arrays([groupBytes, objectBytes]);
};

/**
 * Deserialize a `Location` from a `ReadableStream`.
 */
export const deserializeLocation = async (reader: ReadableStream): Promise<Location> => {
  const group = await deserializeQuicVarInt(reader);
  const object = await deserializeQuicVarInt(reader);
  return { group, object };
};

/**
 * Compare two locations lexicographically by group then object.
 * @returns -1, 0, or 1 for a<b, a==b, a>b respectively.
 */
export const compareLocations = (a: Location, b: Location): number => {
  if (a.group < b.group) return -1;
  if (a.group > b.group) return 1;
  if (a.object < b.object) return -1;
  if (a.object > b.object) return 1;
  return 0;
};
