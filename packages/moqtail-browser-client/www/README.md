# moqtail-browser-client demo

This folder contains a very small web example that loads the `moqtail-browser-client` WASM module and performs a simple subscription.

## Building

1. Install [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/).
2. Build the package:

```bash
wasm-pack build --target web ..
```

This will generate the `pkg/` folder with the JS bindings.

## Running

After building, simply open `index.html` in a browser that supports WebTransport.
