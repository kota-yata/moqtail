## moqtail
![NPM Version](https://img.shields.io/npm/v/moqtail)

Media over QUIC Transport implementation for browsers. Currently kept up with Draft-04.

## About the npm package
I published this library before any testing and did a horrible versioning, so don't use this library with the version lower than 1.2.1

## Usage
```
npm i moqtail
```

Available properties and methods are as follows:
- `MOQT` class: The core MoQT class including reading/writing most of the control messages (some are not yet implemented)
- `moqtUtils` methods: Utils for handling moqt messages
- MoQT parameters: See src/constants.ts for all exported constants
