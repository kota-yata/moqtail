import { Mogger } from "./mogger";

export class Float32RingBuffer {
  private buffer: Float32Array;
  private capacity: number;
  private writePos = 0;
  private readPos = 0;
  private started = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  getStats() {
    return {
      capacity: this.capacity,
      writePos: this.writePos,
      readPos: this.readPos,
    };
  }

  write(data: Float32Array) {
    if (!this.started) {
      this.clear();
      this.started = true;
    }
    if (data.length > this.capacity) {
      Mogger.warn(`Data length ${data.length} exceeds buffer capacity ${this.capacity}. Truncating data.`);
      data = data.subarray(0, this.capacity);
      this.writePos = 0;
      return;
    }
    const remaining = this.capacity - this.writePos;
    if (data.length <= remaining) {
      this.buffer.set(data, this.writePos);
      this.writePos = (this.writePos + data.length) % this.capacity;
    } else {
      const firstPart = this.capacity - this.writePos;
      this.buffer.set(data.subarray(0, firstPart), this.writePos);
      const secondPart = data.subarray(firstPart);
      this.buffer.set(secondPart, 0);
      this.writePos = secondPart.length;
      // if the write position is ahead of the read position, update the read position
      this.readPos = this.writePos > this.readPos ? this.writePos : this.readPos;
    }
  }

  read(length: number): Float32Array {
    if (!this.started) {
      Mogger.warn("Buffer not started. Returning empty array.");
      return new Float32Array(0);
    }
    if (length > this.capacity) {
      Mogger.warn(`Requested length ${length} exceeds buffer capacity ${this.capacity}. Truncating read.`);
      length = this.capacity;
    }
    const remaining = this.capacity - this.readPos;
    let data: Float32Array;
    if (length <= remaining) {
      data = this.buffer.subarray(this.readPos, this.readPos + length);
      this.readPos = (this.readPos + length) % this.capacity;
    } else {
      const firstPart = this.buffer.subarray(this.readPos, this.capacity);
      const secondPart = this.buffer.subarray(0, length - remaining);
      data = new Float32Array(firstPart.length + secondPart.length);
      data.set(firstPart);
      data.set(secondPart, firstPart.length);
      this.readPos = secondPart.length;
    }
    return data;
  }

  clear() {
    this.buffer.fill(0);
    this.writePos = 0;
    this.readPos = 0;
  }
}
