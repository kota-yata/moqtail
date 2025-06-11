// serializer/deserializer for Low Overhead Container (https://datatracker.ietf.org/doc/draft-mzanaty-moq-loc/)
import type { ExtensionHeader } from "../dataStreams/extensionHeader";
import { buffRead, buffReadFromArray, concatUint8Arrays, serializeQuicVarInt, stringToVarBytes, varBytesToString, deserializeQuicVarInt, varBytesToStringFromArray, deserializeQuicVarIntFromArray } from "bytes"

export const serializeEncodedChunk = (obj: EncodedVideoChunk | EncodedAudioChunk): Uint8Array => {
  const typeBytes = stringToVarBytes(obj.type);
  const timestampBytes = serializeQuicVarInt(obj.timestamp);
  const durationBytes = serializeQuicVarInt(obj.duration);
  const byteLengthBytes = serializeQuicVarInt(obj.byteLength);
  const payload = new Uint8Array(obj.byteLength);
  obj.copyTo(payload);
  return concatUint8Arrays([typeBytes, timestampBytes, durationBytes, byteLengthBytes, payload]);
}

export const deserializeEncodedChunk = async (reader: ReadableStream): Promise<EncodedVideoChunkInit | EncodedAudioChunkInit> => {
  const type = await varBytesToString(reader) as 'delta' | 'key';
  const timestamp = await deserializeQuicVarInt(reader);
  const duration = await deserializeQuicVarInt(reader);
  const byteLength = await deserializeQuicVarInt(reader);
  const data = await buffRead(reader, byteLength);
  return { type, timestamp, duration, data };
}

export const deserializeEncodedChunkFromArray = (
  data: Uint8Array
): EncodedVideoChunkInit | EncodedAudioChunkInit => {
  let offset = 0;
  let result: { value: any; byteLength: number } = varBytesToStringFromArray(data, offset);
  const type = result.value as 'delta' | 'key';
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(data, offset);
  const timestamp = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(data, offset);
  const duration = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(data, offset);
  const byteLength = result.value;
  offset += result.byteLength;
  const payload = buffReadFromArray(data, byteLength, offset);
  return { type, timestamp, duration, data: payload };
};

export const LOC_EXTENSION_HEADER_TYPE = {
  CAPTURE_TIMESTAMP: 2,
  VIDEO_CONFIG: 15, // 16
  AUDIO_CONFIG: 17,
  VIDEO_FRAME_MARKING: 4,
  AUDIO_LEVEL: 6,
  DATAGRAM_FRAGMENT_INFO: 31
} as const;

export const videoDecoderConfigToExtensionHeader = (config: VideoDecoderConfig): ExtensionHeader => {
  const codecBytes = stringToVarBytes(config.codec);
  const widthBytes = serializeQuicVarInt(config.codedWidth ?? 0);
  const heightBytes = serializeQuicVarInt(config.codedHeight ?? 0);
  const displayAspectWidthBytes = serializeQuicVarInt(config.displayAspectWidth ?? 0);
  const displayAspectHeightBytes = serializeQuicVarInt(config.displayAspectHeight ?? 0);
  const colorSpaceBytes = stringToVarBytes(JSON.stringify(config.colorSpace ?? ''));
  const hardwareAccelerationBytes = stringToVarBytes(config.hardwareAcceleration ?? 'no-preference');
  // TODO: let moqmi packager handle desc instead of here
  const desc = config.description as ArrayBuffer;
  const codecDescBytes = desc ? new Uint8Array(desc) : new Uint8Array(0);
  const codecDescLengthBytes = serializeQuicVarInt(codecDescBytes.byteLength);
  const data = concatUint8Arrays([codecBytes, widthBytes, heightBytes, displayAspectWidthBytes, displayAspectHeightBytes, colorSpaceBytes, hardwareAccelerationBytes, codecDescLengthBytes, codecDescBytes]);
  return { id: LOC_EXTENSION_HEADER_TYPE.VIDEO_CONFIG, value: data };
}

// export const deserializeVideoDecoderConfig = async (readableStream: ReadableStream): Promise<VideoDecoderConfig> => {
//   const ret: VideoDecoderConfig = {} as VideoDecoderConfig;
//   ret.codec = await varBytesToString(readableStream);
//   const codedWidth = await deserializeQuicVarInt(readableStream);
//   if (codedWidth) ret.codedWidth = codedWidth;
//   const codedHeight = await deserializeQuicVarInt(readableStream);
//   if (codedHeight) ret.codedHeight = codedHeight;
//   const displayAspectWidth = await deserializeQuicVarInt(readableStream);
//   if (displayAspectWidth) ret.displayAspectWidth = displayAspectWidth;
//   const displayAspectHeight = await deserializeQuicVarInt(readableStream);
//   if (displayAspectHeight) ret.displayAspectHeight = displayAspectHeight;
//   const cs = await varBytesToString(readableStream);
//   if (cs) ret.colorSpace = JSON.parse(cs);
//   ret.hardwareAcceleration = await varBytesToString(readableStream) as HardwareAcceleration;
//   const descLength = await deserializeQuicVarInt(readableStream);
//   if (descLength) {
//     const desc = await buffRead(readableStream, descLength);
//     ret.description = desc;
//   }
//   return ret;
// }

export const deserializeVideoDecoderConfig = (buff: Uint8Array): VideoDecoderConfig => {
  const ret: VideoDecoderConfig = {} as VideoDecoderConfig;
  let offset: number = 0;
  let result: { value: any, byteLength: number };
  result = varBytesToStringFromArray(buff);
  ret.codec = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  if (result.value) ret.codedWidth = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  if (result.value) ret.codedHeight = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  if (result.value) ret.displayAspectWidth = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  if (result.value) ret.displayAspectHeight = result.value;
  offset += result.byteLength;
  result = varBytesToStringFromArray(buff, offset);
  if (result.value) ret.colorSpace = JSON.parse(result.value);
  offset += result.byteLength;
  result = varBytesToStringFromArray(buff, offset);
  if (result.value) ret.hardwareAcceleration = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  if (result.value) {
    offset += result.byteLength;
    const desc = new Uint8Array(buff.slice(offset, offset + result.value));
    ret.description = desc.buffer;
  }

  return ret;
}

export const audioDecoderConfigToExtensionHeader = (config: AudioDecoderConfig): ExtensionHeader => {
  const codecBytes = stringToVarBytes(config.codec);
  const sampleRateBytes = serializeQuicVarInt(config.sampleRate);
  const channelCountBytes = serializeQuicVarInt(config.numberOfChannels);
  const data = concatUint8Arrays([codecBytes, sampleRateBytes, channelCountBytes]);
  return { id: LOC_EXTENSION_HEADER_TYPE.AUDIO_CONFIG, value: data };
}

export const deserializeAudioDecoderConfig = async (readableStream: ReadableStream): Promise<AudioDecoderConfig> => {
  const ret: AudioDecoderConfig = {} as AudioDecoderConfig;
  ret.codec = await varBytesToString(readableStream);
  ret.sampleRate = await deserializeQuicVarInt(readableStream);
  ret.numberOfChannels = await deserializeQuicVarInt(readableStream);
  return ret;
}

export const captureTimestampToExtensionHeader = (timestamp: number): ExtensionHeader => {
  return { id: LOC_EXTENSION_HEADER_TYPE.CAPTURE_TIMESTAMP, value: timestamp };
}

export const deserializeCaptureTimestamp = (buff: Uint8Array): number => {
  const timestamp = deserializeQuicVarIntFromArray(buff, 0);
  return timestamp.value;
}

export const datagramFragmentInfoToExtensionHeader = (
  fragmentIndex: number,
  totalFragments: number
): ExtensionHeader => {
  const indexBytes = serializeQuicVarInt(fragmentIndex);
  const totalBytes = serializeQuicVarInt(totalFragments);
  const data = concatUint8Arrays([indexBytes, totalBytes]);
  return { id: LOC_EXTENSION_HEADER_TYPE.DATAGRAM_FRAGMENT_INFO, value: data };
};

export const deserializeDatagramFragmentInfo = (
  buff: Uint8Array
): { fragmentIndex: number; totalFragments: number } => {
  let offset = 0;
  let result = deserializeQuicVarIntFromArray(buff, offset);
  const fragmentIndex = result.value;
  offset += result.byteLength;
  result = deserializeQuicVarIntFromArray(buff, offset);
  const totalFragments = result.value;
  return { fragmentIndex, totalFragments };
};
