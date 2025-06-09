import type { Datagram } from "moqtail";
export interface BufferedDatagram {
  header: Datagram;
  encodedChunkInit: EncodedAudioChunkInit | EncodedVideoChunkInit;
}

export class DatagramBuffer {
  private buffer: Map<number, BufferedDatagram[]> = new Map();

  enqueue(datagram: BufferedDatagram) {
    const group = this.buffer.get(datagram.header.groupId) || [];
    group.push(datagram);
    group.sort((a, b) => a.header.objectId - b.header.objectId);
    this.buffer.set(datagram.header.groupId, group);
  }

  popGroup(groupId: number): BufferedDatagram[] {
    const group = this.buffer.get(groupId) || [];
    this.buffer.delete(groupId);
    return group;
  }

  hasGroup(groupId: number): boolean {
    return this.buffer.has(groupId);
  }

  clear() {
    this.buffer.clear();
  }
}
