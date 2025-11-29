[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kota-yata/moqtail)

# moqtail
moqtail is a client implementation of Media over QUIC Transport protocol (MoQT).

This is the root directory of the moqtail projects. The core library lives under the `moqtail-core` workspace. Run `make install` to create symbolic links so you can develop the client and core packages together.

## Use moqtail-core in your project
moqtail-core provides a basic MoQT worker along with serializers/deserializers for the control messages, data streams, and packagers.

```
npm install moqtail
```

Refer to [moqtail-core/README.md](./moqtail-core/README.md) for usage instructions.

### Supported messages
moqtail-core has serializer/deserializer for all control messages in draft-11, but these are the ones interopped at IETF:

moqtail cand send:
- [x] CLIENT_SETUP
- [x] SUBSCRIBE
- [x] UNSUBSCRIBE
- [x] SUBCSRIBE_OK
- [x] SUBSCRIBE_ERROR
- [x] SUBSCRIBE_DONE
- [x] ANNOUNCE
- [x] UNANNOUNCE

moqtail can receive:
- [x] SERVER_SETUP
- [x] UNSUBSCRIBE
- [x] SUBSCRIBE
- [x] SUBCSRIBE_OK
- [x] SUBSCRIBE_ERROR
- [x] SUBSCRIBE_DONE
- [x] ANNOUNCE_OK
- [x] ANNOUNCE_ERROR

not yet interopped:
- [ ] GOAWAY
- [ ] MAX_REQUEST_ID
- [ ] REQUESTS_BLOCKED
- [ ] SUBSCRIBE_UPDATE
- [ ] FETCH
- [ ] FETCH_OK
- [ ] FETCH_ERROR
- [ ] FETCH_CANCEL
- [ ] TRACK_STATUS_REQUEST
- [ ] TRACK_STATUS
- [ ] ANNOUNCE_CANCEL
- [ ] SUBSCRIBE_ANNOUNCES
- [ ] SUBSCRIBE_ANNOUNCES_OK
- [ ] SUBSCRIBE_ANNOUNCES_ERROR
- [ ] UNSUBSCRIBE_ANNOUNCES

moqtail can also send/receive
- [x] Datagram
- [x] Subgroup Object

### Repository Structure

- **bytes/**
  - Utility code and helpers for handling low-level byte operations, encoding, and decoding. Used internally by client/ and moqtail-core/.

- **client/**
  - Contains a live streaming application as a reference client implementation of MoQT.

- **moqtail-core/**
  - The main core library, providing serializers/deserializers for MOQT control messages, data streams, and packagers.

### Build Commands

Use the Makefile to manage development and production builds:

```bash
make install   # install workspace dependencies
make prod      # build all workspaces for production
make dev       # build libraries and start the client in dev mode
```
