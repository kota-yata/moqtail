const MAX_U6 = Math.pow(2, 6) - 1;
const MAX_U14 = Math.pow(2, 14) - 1;
const MAX_U30 = Math.pow(2, 30) - 1;
const MAX_U53 = Number.MAX_SAFE_INTEGER;
// const MAX_U62 = 2n ** 62n - 1n

export const buffReadFrombyobReader = async (reader: ReadableStreamBYOBReader, buffer: ArrayBuffer, offset: number, size: number): Promise<ArrayBuffer> => {
  const ret = null;
  if (size <= 0) {
    return ret;
  }
  let remainingSize = size;
  while (remainingSize > 0) {
    const { value, done } = await reader.read(new Uint8Array(buffer, offset, remainingSize));
    if (value !== undefined) {
      buffer = value.buffer;
      offset += value.byteLength;
      remainingSize = remainingSize - value.byteLength;
    }
    if (done && remainingSize > 0) {
      throw new Error('short buffer');
    }
  }
  return buffer;
};

export const getQuicVarIntLength = (v: number | bigint) => {
  if (v <= MAX_U6) {
    return 1;
  } else if (v <= MAX_U14) {
    return 2;
  } else if (v <= MAX_U30) {
    return 4;
  } else if (v <= MAX_U53) {
    return 8;
  } else {
    throw new Error(`overflow, value larger than 53-bits: ${v}`);
  }
}

export const serializeQuicVarInt = (value: number | bigint) => {
  if (typeof value === 'number') value = BigInt(value);
  if (value < 0n || value > 0x3fffffffffffffffn) {
    throw new Error('Value out of range for QUIC varInt');
  }
  let buffer: Uint8Array;
  if (value <= MAX_U6) {
    buffer = new Uint8Array(1);
    buffer[0] = Number(value);
  } else if (value <= MAX_U14) {
    buffer = new Uint8Array(2);
    buffer[0] = Number((value >> 8n) | 0x40n);
    buffer[1] = Number(value & 0xffn);
  } else if (value <= MAX_U30) {
    buffer = new Uint8Array(4);
    buffer[0] = Number((value >> 24n) | 0x80n);
    buffer[1] = Number((value >> 16n) & 0xffn);
    buffer[2] = Number((value >> 8n) & 0xffn);
    buffer[3] = Number(value & 0xffn);
  } else {
    buffer = new Uint8Array(8);
    buffer[0] = Number((value >> 56n) | 0xc0n);
    buffer[1] = Number((value >> 48n) & 0xffn);
    buffer[2] = Number((value >> 40n) & 0xffn);
    buffer[3] = Number((value >> 32n) & 0xffn);
    buffer[4] = Number((value >> 24n) & 0xffn);
    buffer[5] = Number((value >> 16n) & 0xffn);
    buffer[6] = Number((value >> 8n) & 0xffn);
    buffer[7] = Number(value & 0xffn);
  }
  return buffer;
};

export const deserializeQuicVarInt = async (readableStream: ReadableStream): Promise<number> => {
  let ret: number;
  const reader = readableStream.getReader({ mode: 'byob' });
  try {
    let buff = new ArrayBuffer(8);

    buff = await buffReadFrombyobReader(reader, buff, 0, 1);
    const size = (new DataView(buff, 0, 1).getUint8(0) & 0xc0) >> 6;
    if (size === 0) {
      ret = new DataView(buff, 0, 1).getUint8(0) & 0x3f;
    } else if (size === 1) {
      buff = await buffReadFrombyobReader(reader, buff, 1, 1);
      ret = new DataView(buff, 0, 2).getUint16(0) & 0x3fff;
    } else if (size === 2) {
      buff = await buffReadFrombyobReader(reader, buff, 1, 3);
      ret = new DataView(buff, 0, 4).getUint32(0) & 0x3fffffff;
    } else if (size === 3) {
      buff = await buffReadFrombyobReader(reader, buff, 1, 7);
      ret = Number(new DataView(buff, 0, 8).getBigUint64(0) & BigInt('0x3fffffffffffffff'));
    } else {
      throw new Error('impossible');
    }
  } finally {
    reader.releaseLock();
  }
  return ret;
};

export const deserializeQuicVarIntFromArray = (
  data: Uint8Array,
  offset: number = 0
): { value: number; byteLength: number } => {
  if (offset >= data.length) {
    throw new Error('Offset is out of bounds');
  }

  const size = (data[offset] & 0xc0) >> 6;
  let value: number;
  let byteLength: number;

  if (size === 0) {
    value = data[offset] & 0x3f;
    byteLength = 1;
  } else if (size === 1) {
    if (data.length < offset + 2) {
      throw new Error('Insufficient data for 2-byte QUIC varInt');
    }
    value = ((data[offset] & 0x3f) << 8) | data[offset + 1];
    byteLength = 2;
  } else if (size === 2) {
    if (data.length < offset + 4) {
      throw new Error('Insufficient data for 4-byte QUIC varInt');
    }
    value =
      ((data[offset] & 0x3f) << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];
    byteLength = 4;
  } else if (size === 3) {
    if (data.length < offset + 8) {
      throw new Error('Insufficient data for 8-byte QUIC varInt');
    }
    value = Number(
      (BigInt(data[offset] & 0x3f) << 56n) |
      (BigInt(data[offset + 1]) << 48n) |
      (BigInt(data[offset + 2]) << 40n) |
      (BigInt(data[offset + 3]) << 32n) |
      (BigInt(data[offset + 4]) << 24n) |
      (BigInt(data[offset + 5]) << 16n) |
      (BigInt(data[offset + 6]) << 8n) |
      BigInt(data[offset + 7])
    );
    byteLength = 8;
  } else {
    throw new Error('Invalid size for QUIC varInt');
  }

  return { value, byteLength };
};

export const getUint8 = async (readableStream: ReadableStream): Promise<number> => {
  const buf = await buffRead(readableStream, 1);
  return new DataView(buf.buffer).getUint8(0);
};

export const setUint8 = (v: number) => {
  const ret = new Uint8Array(1);
  ret[0] = v;
  return ret;
};

const setUint16 = (v: number) => {
  const ret = new Uint8Array(2);
  const view = new DataView(ret.buffer);
  view.setUint16(0, v);
  return ret;
};

const setUint32 = (v: number) => {
  const ret = new Uint8Array(4);
  const view = new DataView(ret.buffer);
  view.setUint32(0, v);
  return ret;
};

const setUint64 = (v: bigint) => {
  const ret = new Uint8Array(8);
  const view = new DataView(ret.buffer);
  view.setBigUint64(0, v);
  return ret;
};


export const concatUint8Arrays = (arr: Uint8Array[]) => {
  let totalLength = 0;
  arr.forEach(element => {
    if (element !== undefined) {
      totalLength += element.byteLength;
    }
  });
  const retBuffer = new Uint8Array(totalLength);
  let pos = 0;
  arr.forEach(element => {
    if (element !== undefined) {
      retBuffer.set(element, pos);
      pos += element.byteLength;
    }
  });
  return retBuffer;
};

export const concatBuffer = concatUint8Arrays;

export const buffRead = async (readableStream: ReadableStream, size: number): Promise<Uint8Array> => {
  const ret = null;
  if (size <= 0) {
    return ret;
  }
  let buff = new Uint8Array(Number(size));
  const reader = readableStream.getReader({ mode: 'byob' });

  try {
    const ab = await buffReadFrombyobReader(reader, buff, 0, size);
    buff = new Uint8Array(ab);
  } finally {
    reader.releaseLock();
  }
  return buff;
};

export const buffReadFromArray = (data: Uint8Array, size: number, offset: number): Uint8Array => {
  if (size <= 0) {
    return null;
  }
  if (offset + size > data.length) {
    throw new Error('short buffer');
  }
  return data.slice(offset, offset + size);
}

export const readUntilEof = async (readableStream, blockSize) => {
  const chunkArray = [];
  let totalLength = 0;

  while (true) {
    let bufferChunk = new Uint8Array(blockSize);
    const reader = readableStream.getReader({ mode: 'byob' });
    const { value, done } = await reader.read(new Uint8Array(bufferChunk, 0, blockSize));
    if (value !== undefined) {
      bufferChunk = value.buffer;
      chunkArray.push(bufferChunk.slice(0, value.byteLength));
      totalLength += value.byteLength;
    }
    reader.releaseLock();
    if (value === undefined) {
      throw new Error('error reading incoming data');
    }
    if (done) {
      break;
    }
  }
  // Concatenate received data
  const payload = new Uint8Array(totalLength);
  let pos = 0;
  for (const element of chunkArray) {
    const uint8view = new Uint8Array(element, 0, element.byteLength);
    payload.set(uint8view, pos);
    pos += element.byteLength;
  }

  return payload;
};

export const stringToVarBytes = (str: string) => {
  const dataStrBytes = new TextEncoder().encode(str);
  const dataStrLengthBytes = serializeQuicVarInt(dataStrBytes.byteLength);
  return concatUint8Arrays([dataStrLengthBytes, dataStrBytes]);
};

export const varBytesToString = async (receiveStream: ReadableStream) => {
  const size = await deserializeQuicVarInt(receiveStream);
  const buffer = await buffRead(receiveStream, size);
  return new TextDecoder().decode(buffer);
}

export const varBytesToStringFromArray = (data: Uint8Array, offset: number = 0) => {
  const result = deserializeQuicVarIntFromArray(data, offset);
  const start = offset + result.byteLength;
  const buffer = data.slice(start, start + result.value);
  const text = new TextDecoder().decode(buffer);
  return { byteLength: result.byteLength + result.value, value: text };
}
