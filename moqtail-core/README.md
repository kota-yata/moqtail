## moqtail
![NPM Version](https://img.shields.io/npm/v/moqtail)

Media over QUIC Transport (MOQT) utilities for the browser: control-message codecs, data-stream helpers, media packagers (LOC/WARP), and a small typed WebTransport facade.

## Features
- Control messages: serialize/deserialize all core MOQT control messages (`src/messages`)
- Data streams: subgroup headers/objects, datagrams and extension headers (`src/dataStreams`)
- Packagers: Low Overhead Container (LOC) and WARP catalog/timeline helpers (`src/packagers`)
- Transport: typed worker-based facade around WebTransport for evented send/receive (`src/transport`)
- Utilities: var-bytes, key/value pairs, parameters, reasons, namespaces, locations (`src/utils`)

## Installation
```
npm i moqtail
# or
yarn add moqtail
```

## Quick Start (Transport)
```ts
import { createTransport, getTransportWorkerURL } from 'moqtail';

// Create a dedicated worker for the transport layer
const worker = new Worker(getTransportWorkerURL(), { type: 'module' });
const transport = createTransport(worker, { role: 'subscriber', enableDatagrams: false });

// Subscribe to events from the worker
const off = transport.on('subgroup:object', (evt) => {
  const { header, encodedChunkInit } = evt.data;
  console.log('object from subgroup', header.subgroupId, encodedChunkInit);
});

// Connect to a MOQT relay/server over WebTransport
await transport.connect('https://relay.example/moq', { congestionControl: 'throughput' });
```

### Send a control message
```ts
import { serializeClientSetup } from 'moqtail';

const clientSetup = serializeClientSetup({ supportedVersions: [1] });
await transport.sendControlMessage(clientSetup);
```

### Create a subgroup stream and send an object
```ts
import { STREAM } from 'moqtail';
import { serializeSubgroupHeader, serializeSubgroupObject } from 'moqtail';

const subgroupHeader = serializeSubgroupHeader({
  type: STREAM.SUBGROUP_FIELD, // or SUBGROUP_FIELD_WITH_EXTENSION
  trackAlias: 1,
  groupId: 10,
  subgroupId: 0,
  publisherPriority: 0,
});

await transport.createSubgroupStream({ subgroupId: 0, subgroupHeader });

const objectBytes = serializeSubgroupObject({
  objectId: 0,
  extensionHeaders: [],
  payload: new Uint8Array([1, 2, 3]),
});

await transport.sendSubgroupObject({ subgroupId: 0, subgroupObject: objectBytes, isLast: true });
```

### Send a datagram
```ts
await transport.sendDatagram(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
```

## LOC Packager Examples
```ts
import { serializeEncodedChunk, deserializeEncodedChunk } from 'moqtail';

// Assuming `videoChunk` is an `EncodedVideoChunk`
const bytes = serializeEncodedChunk(videoChunk);

// Later on (e.g., on the receiver side)
const init = await deserializeEncodedChunk(new ReadableStream({
  start(c) { c.enqueue(bytes); c.close(); },
  type: 'bytes'
}));
```

## WARP Helpers
```ts
import {
  createWarpCatalog,
  serializeWarpCatalog,
  deserializeWarpCatalogFromArray,
  getTimeAlignedTracks,
  WARP_LOC_PACKAGING
} from 'moqtail';

const catalog = createWarpCatalog([
  { name: 'video', packaging: WARP_LOC_PACKAGING, renderGroup: 1 },
  { name: 'audio', packaging: WARP_LOC_PACKAGING, renderGroup: 1 },
]);

const bytes = serializeWarpCatalog(catalog);
const parsed = deserializeWarpCatalogFromArray(bytes);
const aligned = getTimeAlignedTracks(parsed); // [[video, audio]]
```

## Web Tester
A small test UI is available under `web-tester/`.

Run it with Vite:
```
yarn web:dev
# or
npm run web:dev
```

## Documentation
- Generate API docs with TypeDoc: `yarn docs` or `npm run docs`
- Output is written to `docs/` using the `typedoc-theme-fresh` theme.
