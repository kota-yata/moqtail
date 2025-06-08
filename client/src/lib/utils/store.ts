import { writable } from 'svelte/store';

export const moqVideoTransmissionLatencyStore = writable<number>(0);

export const ringStats = writable<RingBufferStats>({
  capacity: 48000,
  writePos: 0,
  readPos: 0
});
