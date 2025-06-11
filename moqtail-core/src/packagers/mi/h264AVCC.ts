import type { ExtensionHeader } from "../../dataStreams/extensionHeader";
import { buffRead, concatUint8Arrays, serializeQuicVarInt, deserializeQuicVarInt } from "bytes";
import { MI_EXTENSION_HEADER_TYPE } from "./miExtensionHeaders";

export type H264AVCCMetadata = {
  seqId: number,
  pts: number,
  dts: number,
  timebase: number,
  duration: number,
  wallclock: number
}

export const H264AVCCMetadataToExtensionHeader = (props: H264AVCCMetadata): ExtensionHeader => {
  const seqIdBytes = serializeQuicVarInt(props.seqId);
  const ptsBytes = serializeQuicVarInt(props.pts);
  const dtsBytes = serializeQuicVarInt(props.dts);
  const timebaseBytes = serializeQuicVarInt(props.timebase);
  const durationBytes = serializeQuicVarInt(props.duration);
  const wallclockBytes = serializeQuicVarInt(props.wallclock);
  const data = concatUint8Arrays([seqIdBytes, ptsBytes, dtsBytes, timebaseBytes, durationBytes, wallclockBytes]);
  return { id: MI_EXTENSION_HEADER_TYPE.H264AVCC_METADATA, value: data };
}

export const deserializeH264AVCCMetadata = async (controlReader: ReadableStream): Promise<H264AVCCMetadata> => {
  const seqId = await deserializeQuicVarInt(controlReader);
  const pts = await deserializeQuicVarInt(controlReader);
  const dts = await deserializeQuicVarInt(controlReader);
  const timebase = await deserializeQuicVarInt(controlReader);
  const duration = await deserializeQuicVarInt(controlReader);
  const wallclock = await deserializeQuicVarInt(controlReader);
  return { seqId, pts, dts, timebase, duration, wallclock };
}

export const H264AVCCExtraDataToExtensionHeader = (props: ArrayBuffer): ExtensionHeader => {
  return { id: MI_EXTENSION_HEADER_TYPE.H264AVCC_EXTRA_DATA, value: new Uint8Array(props) };
}

// type AVCDecoderConfigurationRecord = {
//   configurationVersion: number; // 8 bits, typically 1
//   AVCProfileIndication: number; // 8 bits, specifies the profile (e.g., Baseline, Main, High)
//   profileCompatibility: number; // 8 bits, compatibility flags
//   AVCLevelIndication: number; // 8 bits, specifies the level (e.g., Level 3.1)
//   lengthSizeMinusOne: number; // 2 bits, indicates the size of NALUnitLength field minus one
//   sequenceParameterSets: {
//     sequenceParameterSetLength: number; // 16 bits, length of SPS NAL unit
//     sequenceParameterSetNALUnit: Uint8Array; // SPS NAL unit data
//   }[];
//   pictureParameterSets: {
//     pictureParameterSetLength: number; // 16 bits, length of PPS NAL unit
//     pictureParameterSetNALUnit: Uint8Array; // PPS NAL unit data
//   }[];
// };

// export type H264AVCCExtraData = {
//   extraData: AVCDecoderConfigurationRecord
// }

// export const serializeH264AVCCExtraData = (props: H264AVCCExtraData): Uint8Array => {
//   const configurationVersion = serializeQuicVarInt(props.extraData.configurationVersion);
//   const AVCProfileIndication = serializeQuicVarInt(props.extraData.AVCProfileIndication);
//   const profileCompatibility = serializeQuicVarInt(props.extraData.profileCompatibility);
//   const AVCLevelIndication = serializeQuicVarInt(props.extraData.AVCLevelIndication);
//   const lengthSizeMinusOne = serializeQuicVarInt(props.extraData.lengthSizeMinusOne);
//   const sequenceParameterSets = props.extraData.sequenceParameterSets.map(sps => concatUint8Arrays([serializeQuicVarInt(sps.sequenceParameterSetLength), sps.sequenceParameterSetNALUnit]));
//   const pictureParameterSets = props.extraData.pictureParameterSets.map(pps => concatUint8Arrays([serializeQuicVarInt(pps.pictureParameterSetLength), pps.pictureParameterSetNALUnit]));
//   return concatUint8Arrays([configurationVersion, AVCProfileIndication, profileCompatibility, AVCLevelIndication, lengthSizeMinusOne, ...sequenceParameterSets, ...pictureParameterSets]);
// }

// export const deserializeH264AVCCExtraData = async (controlReader: ReadableStream): Promise<H264AVCCExtraData> => {
//   const configurationVersion = await deserializeQuicVarInt(controlReader);
//   const AVCProfileIndication = await deserializeQuicVarInt(controlReader);
//   const profileCompatibility = await deserializeQuicVarInt(controlReader);
//   const AVCLevelIndication = await deserializeQuicVarInt(controlReader);
//   const lengthSizeMinusOne = await deserializeQuicVarInt(controlReader);
//   const sequenceParameterSets = [];
//   const numSPS = await deserializeQuicVarInt(controlReader);
//   for (let i = 0; i < numSPS; i++) {
//     const sequenceParameterSetLength = await deserializeQuicVarInt(controlReader);
//     const sequenceParameterSetNALUnit = await buffRead(controlReader, sequenceParameterSetLength);
//     sequenceParameterSets.push({ sequenceParameterSetLength, sequenceParameterSetNALUnit });
//   }
//   const pictureParameterSets = [];
//   const numPPS = await deserializeQuicVarInt(controlReader);
//   for (let i = 0; i < numPPS; i++) {
//     const pictureParameterSetLength = await deserializeQuicVarInt(controlReader);
//     const pictureParameterSetNALUnit = await buffRead(controlReader, pictureParameterSetLength);
//     pictureParameterSets.push({ pictureParameterSetLength, pictureParameterSetNALUnit });
//   }
//   return { extraData: { configurationVersion, AVCProfileIndication, profileCompatibility, AVCLevelIndication, lengthSizeMinusOne, sequenceParameterSets, pictureParameterSets } };
// }
