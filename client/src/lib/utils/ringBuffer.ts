import { Mogger } from "./mogger";

/**
 * A circular buffer implementation for Float32 audio data.
 * Handles wrap-around correctly and provides proper overflow/underflow handling.
 */
export class Float32RingBuffer {
  private buffer: Float32Array;
  private capacity: number;
  private size: number = 0;  // Current amount of data in buffer
  private writePos: number = 0;
  private readPos: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  /**
   * Get current buffer statistics
   */
  getStats(): RingBufferStats {
    return {
      capacity: this.capacity,
      writePos: this.writePos,
      readPos: this.readPos,
      size: this.size,
      available: this.available(),
      free: this.free()
    };
  }

  /**
   * Get the amount of data available to read
   */
  available(): number {
    return this.size;
  }

  /**
   * Get the amount of free space in the buffer
   */
  free(): number {
    return this.capacity - this.size;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Write data to the buffer
   * @param data The data to write
   * @returns The number of samples actually written
   */
  write(data: Float32Array): number {
    if (data.length === 0) return 0;

    const freeSpace = this.free();
    if (freeSpace === 0) {
      Mogger.warn("Ring buffer is full, cannot write data");
      return 0;
    }

    // Determine how much we can actually write
    const toWrite = Math.min(data.length, freeSpace);
    
    if (toWrite < data.length) {
      Mogger.warn(`Buffer has space for ${toWrite} samples, but ${data.length} were provided. Truncating.`);
    }

    // Write the data in up to two parts (before and after wrap-around)
    let written = 0;
    
    // First part: from writePos to end of buffer
    const firstPartSize = Math.min(toWrite, this.capacity - this.writePos);
    if (firstPartSize > 0) {
      this.buffer.set(data.subarray(0, firstPartSize), this.writePos);
      written += firstPartSize;
      this.writePos = (this.writePos + firstPartSize) % this.capacity;
    }

    // Second part: from beginning of buffer (if we wrapped around)
    const secondPartSize = toWrite - firstPartSize;
    if (secondPartSize > 0) {
      this.buffer.set(data.subarray(firstPartSize, firstPartSize + secondPartSize), 0);
      written += secondPartSize;
      this.writePos = secondPartSize;
    }

    this.size += written;
    return written;
  }

  /**
   * Read data from the buffer
   * @param length The number of samples to read
   * @returns The data read (may be less than requested if not enough available)
   */
  read(length: number): Float32Array {
    if (length === 0 || this.isEmpty()) {
      return new Float32Array(0);
    }

    // Determine how much we can actually read
    const toRead = Math.min(length, this.size);
    
    if (toRead < length) {
      Mogger.debug(`Requested ${length} samples but only ${toRead} available`);
    }

    const result = new Float32Array(toRead);
    let readCount = 0;

    // Read in up to two parts (before and after wrap-around)
    // First part: from readPos to end of buffer
    const firstPartSize = Math.min(toRead, this.capacity - this.readPos);
    if (firstPartSize > 0) {
      result.set(this.buffer.subarray(this.readPos, this.readPos + firstPartSize), 0);
      readCount += firstPartSize;
      this.readPos = (this.readPos + firstPartSize) % this.capacity;
    }

    // Second part: from beginning of buffer (if we wrapped around)
    const secondPartSize = toRead - firstPartSize;
    if (secondPartSize > 0) {
      result.set(this.buffer.subarray(0, secondPartSize), firstPartSize);
      readCount += secondPartSize;
      this.readPos = secondPartSize;
    }

    this.size -= readCount;
    return result;
  }

  /**
   * Peek at data without removing it from the buffer
   * @param length The number of samples to peek
   * @returns The data (may be less than requested if not enough available)
   */
  peek(length: number): Float32Array {
    if (length === 0 || this.isEmpty()) {
      return new Float32Array(0);
    }

    const toPeek = Math.min(length, this.size);
    const result = new Float32Array(toPeek);
    let tempReadPos = this.readPos;
    let peekCount = 0;

    // First part
    const firstPartSize = Math.min(toPeek, this.capacity - tempReadPos);
    if (firstPartSize > 0) {
      result.set(this.buffer.subarray(tempReadPos, tempReadPos + firstPartSize), 0);
      peekCount += firstPartSize;
      tempReadPos = (tempReadPos + firstPartSize) % this.capacity;
    }

    // Second part
    const secondPartSize = toPeek - firstPartSize;
    if (secondPartSize > 0) {
      result.set(this.buffer.subarray(0, secondPartSize), firstPartSize);
    }

    return result;
  }

  /**
   * Skip/discard a number of samples without reading them
   * @param length The number of samples to skip
   * @returns The number of samples actually skipped
   */
  skip(length: number): number {
    const toSkip = Math.min(length, this.size);
    this.readPos = (this.readPos + toSkip) % this.capacity;
    this.size -= toSkip;
    return toSkip;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(0);
    this.writePos = 0;
    this.readPos = 0;
    this.size = 0;
  }

  /**
   * Write data to buffer with overflow handling
   * If buffer is full, old data will be overwritten
   * @param data The data to write
   * @returns The number of samples written
   */
  writeWithOverflow(data: Float32Array): number {
    if (data.length === 0) return 0;

    if (data.length > this.capacity) {
      Mogger.warn(`Data length ${data.length} exceeds buffer capacity ${this.capacity}. Only writing last ${this.capacity} samples.`);
      // If data is larger than buffer, only keep the most recent samples
      return this.writeWithOverflow(data.subarray(data.length - this.capacity));
    }

    // If not enough space, make room by discarding old data
    const spaceNeeded = data.length - this.free();
    if (spaceNeeded > 0) {
      this.skip(spaceNeeded);
      Mogger.debug(`Discarded ${spaceNeeded} samples to make room for new data`);
    }

    return this.write(data);
  }
}
