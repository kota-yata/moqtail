import type { Datagram } from "moqtail";
export interface BufferedDatagram {
  header: Datagram;
  encodedChunkInit: EncodedAudioChunkInit | EncodedVideoChunkInit;
}

export class DatagramBuffer {
  private buffer: Map<number, BufferedDatagram[]> = new Map();
  private readyGroups: Set<number> = new Set();
  private timestampOffsetMs: number | null = null;

  setTimestampOffset(offsetMs: number) {
    this.timestampOffsetMs = offsetMs;
  }

  enqueue(datagram: BufferedDatagram) {
    const group = this.buffer.get(datagram.header.groupId) || [];
    group.push(datagram);
    group.sort((a, b) => (a.encodedChunkInit.timestamp ?? 0) - (b.encodedChunkInit.timestamp ?? 0));
    this.buffer.set(datagram.header.groupId, group);
  }

  releaseGroup(groupId: number) {
    if (this.buffer.has(groupId)) {
      this.readyGroups.add(groupId);
    }
  }

  dequeueReady(nowMs: number): BufferedDatagram[] {
    const out: BufferedDatagram[] = [];
    if (this.timestampOffsetMs === null) return out;

    for (const groupId of Array.from(this.readyGroups)) {
      const group = this.buffer.get(groupId);
      if (!group || group.length === 0) {
        this.readyGroups.delete(groupId);
        this.buffer.delete(groupId);
        continue;
      }

      while (group.length > 0) {
        const d = group[0];
        const playTime = (d.encodedChunkInit.timestamp ?? 0) / 1000 + this.timestampOffsetMs;
        if (playTime <= nowMs) {
          out.push(d);
          group.shift();
        } else {
          break;
        }
      }

      if (group.length === 0) {
        this.readyGroups.delete(groupId);
        this.buffer.delete(groupId);
      } else {
        this.buffer.set(groupId, group);
      }
    }

    return out;
  }

  hasGroup(groupId: number): boolean {
    return this.buffer.has(groupId);
  }

  clear() {
    this.buffer.clear();
    this.readyGroups.clear();
    this.timestampOffsetMs = null;
  }
}
