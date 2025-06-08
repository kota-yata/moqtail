import { Float32RingBuffer } from '$lib/utils/ringBuffer';

// Audio Worklet processor for the audio thread
class AudioPlaybackProcessor extends AudioWorkletProcessor {
  private buffer: Float32RingBuffer;
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }
  handleMessage(event) {
    switch (event.data.type) {
    case 'init':
      this.buffer = new Float32RingBuffer(event.data.sampleRate); // 1 second buffer
      break;
    case 'audioData':
      const ab = event.data.buffer as ArrayBufferLike;
      this.buffer.write(new Float32Array(ab));
      break;
    default:
      this.port.postMessage({ type: 'error', data: `Unknown message type: ${event.data.type}` });
    }
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const output = outputs[0]; // Assuming monoral
    const channelOut = output[0];
    const samples = this.buffer.read(channelOut.length);
    const framesToCopy = Math.min(samples.length, channelOut.length);
    for (let i = 0; i < framesToCopy; i++) {
      channelOut[i] = samples[i];
    }
    // in case the read size is truncated, fill the rest with 0
    for (let i = framesToCopy; i < channelOut.length; i++) {
      channelOut[i] = 0;
    }
    const stats = this.buffer.getStats();
    this.port.postMessage({ type: 'stats', stats });
    return true;
  }
}

registerProcessor('audio-playback-processor', AudioPlaybackProcessor);
