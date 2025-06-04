export const VIDEO_ENCODER_MOQMI_CONFIG: VideoEncoderConfig = {
  codec: 'avc1.42001e',
  width: 480,
  height: 360,
  framerate: 30,
  latencyMode: 'realtime',
};
export const VIDEO_ENCODER_DEFAULT_CONFIG: VideoEncoderConfig = {
  codec: 'vp8',
  width: 480,
  height: 360,
  framerate: 30,
  latencyMode: 'realtime'
};
export const AUDIO_ENCODER_DEFAULT_CONFIG: AudioEncoderConfig = {
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 1,
  bitrate: 32000,
};

export const VIDEO_DECODER_DEFAULT_CONFIG: VideoDecoderConfig = {
  codec: 'vp8',
  codedHeight: 360,
  codedWidth: 480,
  colorSpace: { 'fullRange': false, 'matrix': 'smpte170m', 'primaries': 'bt709', 'transfer': 'bt709' },
  hardwareAcceleration: 'no-preference'
};
export const AUDIO_DECODER_DEFAULT_CONFIG: AudioDecoderConfig = {
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 1,
};
