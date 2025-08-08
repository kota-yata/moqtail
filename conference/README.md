# Moqtail Conference

This package provides a minimal bidirectional conferencing example using a single
WebTransport connection. It demonstrates how to establish a connection, send the
initial `CLIENT_SETUP` control message and react to control messages from the
peer.  The implementation is intentionally lightweight and reuses the
serialization helpers from `moqtail`.

The demo now includes a small browser UI (`index.html`) that captures the local
camera stream, encodes it with `VideoEncoder`, and publishes the resulting
encoded chunks over a WebTransport unidirectional stream. Incoming streams are
decoded with `VideoDecoder` and rendered onto a canvas element to illustrate
basic video conferencing.
