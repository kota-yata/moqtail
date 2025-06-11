[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kota-yata/moqtail)

## moqtail
moqtail is a client implementation of Media over QUIC Transport protocol (MoQT).

MoQT is a protocol designed to efficiently transport media streams (such as video, audio, or data) over the QUIC protocol. MOQT leverages QUIC’s features to enable high-performance streaming and real-time communication, making it suitable for modern web applications, broadcasting, and interactive media scenarios.  The implementation in this repository targets the draft-11 specification.

This is the root directory of moqtail projects. The core library lives under the `moqtail-core` workspace. Run `yarn install` to create symbolic links so you can develop the client and core packages together.

### Repository Structure

- **bytes/**
  - Utility code and helpers for handling low-level byte operations, encoding, and decoding. Used internally by client/ and moqtail-core/.

- **client/**
  - Contains a reference client implementation and example usage of moqtail.

- **moqtail-core/**
  - The main core library, providing serializers/deserializers for MOQT control messages, data streams, and packagers.
