## moqtail
<!-- ![NPM Version](https://img.shields.io/npm/v/moqtail) -->

Media over QUIC Transport client implementation for browsers. Currently kept up with Draft-04.

## Usage
Available properties and methods are as follows:
- `MOQT` class: The core MoQT class including reading/writing most of the control messages (some are not yet implemented)
- `moqtUtils` methods: Utils for handling moqt messages
- MoQT parameters: See src/constants.ts for all exported constants

### MOQT Class
Providing control messages in the draft-04.

There are three types of methods in the class:
- `generateXX`: generating control message XX. private
- `readXX`: reading control message XX. public
- `XX`: calling `generateXX` and sending it on a unidirectional stream. public

`readXX` is supposed to parse properties after its message type, because `readControlMessageType` is supposed to be called for retrieving the message type. Mind to call `readControlMessageType` everytime before calling `readXX` like the following example:
```ts
const moqt = new MOQT('https://example.com:4343/moq');
const messageType = moqt.readControlMessageType();
if (type !== MOQ_MESSAGE.SERVER_SETUP) {
  throw new Error(`SETUP answer with type ${type} is not supported`);
}
const setupMessage = await moqt.readServerSetup()
```
