import { deserializeQuicVarInt, readUntilEof } from 'bytes';
import { STREAM } from 'src/constants';

/**
 * Read from a `ReadableStream` until EOF and concatenate to a single buffer.
 *
 * @param readable Source stream to consume.
 * @param blockSize Internal buffer size hint (bytes). Default: 1024.
 * @returns Aggregated data as `Uint8Array`.
 */
export const readStream = async (
  readable: ReadableStream,
  blockSize: number = 1024
): Promise<Uint8Array> => {
  return readUntilEof(readable, blockSize);
};

/**
 * Read and decode an incoming stream type discriminator for MOQT.
 * @returns Parsed `STREAM` enum value.
 */
export const deserializeStreamType = async (readable: ReadableStream): Promise<STREAM> => {
  return (await deserializeQuicVarInt(readable)) as STREAM;
};
