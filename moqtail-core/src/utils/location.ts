import { serializeQuicVarInt, deserializeQuicVarInt, concatUint8Arrays } from 'bytes';

export interface Location {
  group: number;
  object: number;
}

export const serializeLocation = (location: Location): Uint8Array => {
  const groupBytes = serializeQuicVarInt(location.group);
  const objectBytes = serializeQuicVarInt(location.object);
  return concatUint8Arrays([groupBytes, objectBytes]);
};

export const deserializeLocation = async (reader: ReadableStream): Promise<Location> => {
  const group = await deserializeQuicVarInt(reader);
  const object = await deserializeQuicVarInt(reader);
  return { group, object };
};

export const compareLocations = (a: Location, b: Location): number => {
  if (a.group < b.group) return -1;
  if (a.group > b.group) return 1;
  if (a.object < b.object) return -1;
  if (a.object > b.object) return 1;
  return 0;
};