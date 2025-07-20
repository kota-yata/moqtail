import { deserializeQuicVarInt, readUntilEof } from 'bytes';
import { STREAM } from 'src/constants';

// readStream reads from a readable stream until EOF and
// returns the concatenated data as Uint8Array. The optional
// blockSize parameter controls the intermediate buffer size.
export const readStream = async (
  readable: ReadableStream,
  blockSize: number = 1024
): Promise<Uint8Array> => {
  return readUntilEof(readable, blockSize);
};

export const deserializeStreamType = async (readable: ReadableStream): Promise<STREAM> => {
  return await deserializeQuicVarInt(readable) as STREAM;
};
