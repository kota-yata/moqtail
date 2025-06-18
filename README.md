[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kota-yata/moqtail)

## moqtail
moqtail is a client implementation of Media over QUIC Transport protocol (MoQT). Currently moqtail supports MoQT Draft-11.

This is the root directory of the moqtail projects. The core library lives under the `moqtail-core` workspace. Run `make install` to create symbolic links so you can develop the client and core packages together.

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
