# Interop CLI

A simple tool for sending MoQT control messages and data to a server.

## Usage

```bash
# Build dependencies and the CLI
yarn workspace interop start --server <url>
```

The start script builds the `moqtail` workspace before compiling this
project. Ensure the server URL points to a WebTransport endpoint.
