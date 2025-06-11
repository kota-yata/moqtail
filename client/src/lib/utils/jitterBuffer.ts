export interface JitterBufferItem {
  decoder: Worker;
  type: 'video' | 'audio';
  chunk: EncodedVideoChunk | EncodedAudioChunk;
  config?: VideoDecoderConfig | AudioDecoderConfig | null;
  enqueueTime: number;
}

export class JitterBuffer {
  private buffer: JitterBufferItem[] = [];
  constructor(private delayMs = 200) {}

  enqueue(item: Omit<JitterBufferItem, 'enqueueTime'>) {
    this.buffer.push({ ...item, enqueueTime: performance.now() });
  }

  dequeueReady(nowMs: number): JitterBufferItem[] {
    const ready: JitterBufferItem[] = [];
    while (this.buffer.length > 0 && nowMs - this.buffer[0].enqueueTime >= this.delayMs) {
      ready.push(this.buffer.shift() as JitterBufferItem);
    }
    return ready;
  }
}
