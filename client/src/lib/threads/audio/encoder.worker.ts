import { makeMediaEncoderError } from '$lib/types/media-error';

class MoQTAudioEncoder {
  private reader: ReadableStreamDefaultReader<AudioData>;
  private track: Track;
  private state: 'init' | 'capturing' | 'encoding' | 'stopped' = 'stopped';
  private chunkCount = 0;
  onMessage(event: MessageEvent) {
    const data = event.data as ThreadMessage;
    switch (data.type) {
    case 'init':
      this.track = data.data;
      this.state = 'init';
      break;
    case 'capture':
      this.capture(data.data);
      break;
    case 'encode':
      this.encode();
      break;
    case 'stop':
      this.state = 'stopped';
    }
  }
  capture(readable: ReadableStream<AudioData>) {
    this.state = 'capturing';
    this.reader = readable.getReader();
  }
  async encode() {
    this.state = 'encoding';
    const encoder = new AudioEncoder({
      output: (chunk: EncodedAudioChunk, metadata: EncodedAudioChunkMetadata) => this.handleChunk(chunk, metadata),
      error: (error: DOMException) => {
        const err = makeMediaEncoderError(`AudioEncoder error: ${error.message}`, { kind: 'audio', shouldCleanup: true });
        postMessage({ type: 'error', data: err });
      },
    });
    const encoderConfig: MyEncoderConfig = this.track.encoderConfig as MyEncoderConfig;
    encoder.configure(encoderConfig.encoderConfig as AudioEncoderConfig);
    while (this.state === 'encoding') {
      const { done, value } = await this.reader.read();
      if (done) break;
      encoder.encode(value);
      this.chunkCount++;
      value.close();
    }
  }
  handleChunk(chunk: EncodedAudioChunk, metadata: EncodedAudioChunkMetadata) {
    postMessage({ type: 'audioChunk', data: { trackName: this.track.name, chunk, metadata } });
  }
}

const encoder = new MoQTAudioEncoder();
self.addEventListener('message', encoder.onMessage.bind(encoder));

export {};
