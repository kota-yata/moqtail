/*
Copyright (c) Meta Platforms, Inc. and affiliates.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
const MAX_U6 = Math.pow(2, 6) - 1;
const MAX_U14 = Math.pow(2, 14) - 1;
const MAX_U30 = Math.pow(2, 30) - 1;
const MAX_U53 = Number.MAX_SAFE_INTEGER;
// const MAX_U62 = 2n ** 62n - 1n
export const buffReadFrombyobReader = async (reader, buffer, offset, size) => {
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
export const numberToVarInt = (v) => {
    if (v <= MAX_U6) {
        return setUint8(v);
    }
    else if (v <= MAX_U14) {
        return setUint16(v | 0x4000);
    }
    else if (v <= MAX_U30) {
        return setUint32(v | 0x80000000);
    }
    else if (v <= MAX_U53) {
        return setUint64(BigInt(v) | 0xc000000000000000n);
    }
    else {
        throw new Error(`overflow, value larger than 53-bits: ${v}`);
    }
};
export const varIntToNumber = async (readableStream) => {
    let ret;
    const reader = readableStream.getReader({ mode: 'byob' });
    try {
        let buff = new ArrayBuffer(8);
        buff = await buffReadFrombyobReader(reader, buff, 0, 1);
        const size = (new DataView(buff, 0, 1).getUint8() & 0xc0) >> 6;
        if (size === 0) {
            ret = new DataView(buff, 0, 1).getUint8() & 0x3f;
        }
        else if (size === 1) {
            buff = await buffReadFrombyobReader(reader, buff, 1, 1);
            ret = new DataView(buff, 0, 2).getUint16() & 0x3fff;
        }
        else if (size === 2) {
            buff = await buffReadFrombyobReader(reader, buff, 1, 3);
            ret = new DataView(buff, 0, 4).getUint32() & 0x3fffffff;
        }
        else if (size === 3) {
            buff = await buffReadFrombyobReader(reader, buff, 1, 7);
            ret = Number(new DataView(buff, 0, 8).getBigUint64() & BigInt('0x3fffffffffffffff'));
        }
        else {
            throw new Error('impossible');
        }
    }
    finally {
        reader.releaseLock();
    }
    return ret;
};
const setUint8 = (v) => {
    const ret = new Uint8Array(1);
    ret[0] = v;
    return ret;
};
const setUint16 = (v) => {
    const ret = new Uint8Array(2);
    const view = new DataView(ret.buffer);
    view.setUint16(0, v);
    return ret;
};
const setUint32 = (v) => {
    const ret = new Uint8Array(4);
    const view = new DataView(ret.buffer);
    view.setUint32(0, v);
    return ret;
};
const setUint64 = (v) => {
    const ret = new Uint8Array(8);
    const view = new DataView(ret.buffer);
    view.setBigUint64(0, v);
    return ret;
};
export const concatBuffer = (arr) => {
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
export const buffRead = async (readableStream, size) => {
    const ret = null;
    if (size <= 0) {
        return ret;
    }
    let buff = new Uint8Array(Number(size));
    const reader = readableStream.getReader({ mode: 'byob' });
    try {
        buff = await buffReadFrombyobReader(reader, buff, 0, size);
    }
    finally {
        reader.releaseLock();
    }
    return buff;
};
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
export const serializeMetadata = (metadata) => {
    let ret;
    if (isMetadataValid(metadata)) {
        const newData = {};
        // Copy all enumerable own properties
        newData.decoderConfig = Object.assign({}, metadata.decoderConfig);
        // Description is buffer
        if ('description' in metadata.decoderConfig) {
            newData.decoderConfig.descriptionInBase64 = arrayBufferToBase64(metadata.decoderConfig.description);
            delete newData.description;
        }
        // Encode
        const encoder = new TextEncoder();
        ret = encoder.encode(JSON.stringify(newData));
    }
    return ret;
};
export const isMetadataValid = (metadata) => metadata !== undefined && 'decoderConfig' in metadata;
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
export const deSerializeMetadata = (metadata) => {
    const decoder = new TextDecoder();
    const str = decoder.decode(metadata);
    const data = JSON.parse(str);
    if (('decoderConfig' in data) && ('descriptionInBase64' in data.decoderConfig)) {
        data.decoderConfig.description = base64ToArrayBuffer(data.decoderConfig.descriptionInBase64);
        delete data.decoderConfig.descriptionInBase64;
    }
    return data.decoderConfig;
};
const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};
export const stringToBytes = (str) => {
    const dataStrBytes = new TextEncoder().encode(str);
    const dataStrLengthBytes = numberToVarInt(dataStrBytes.byteLength);
    return concatBuffer([dataStrLengthBytes, dataStrBytes]);
};
export const toString = async (receiveStream) => {
    const size = await varIntToNumber(receiveStream);
    const buffer = await buffRead(receiveStream, size);
    return new TextDecoder().decode(buffer);
};
