import { VIDEO_DECODER_DEFAULT_CONFIG } from '$lib/config';
import type { Subscribe } from 'moqtail';

class MoQTVideoDecoder {
  private subscribe: Subscribe;
  private decoder: VideoDecoder;
  onMessage(message: MessageEvent) {
    const data = message.data as ThreadMessage;
    const handlers: { [key: string]: (data: any) => void } = {
      init: this.init.bind(this),
      decode: this.decode.bind(this),
    };
    const handler = handlers[data.type];
    if (!handler) {
      postMessage({ type: 'error', data: `Unknown message type: ${data.type}` });
      return;
    }
    handler(data.data);
  }
  init(subscribe: Subscribe) {
    this.subscribe = subscribe;
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => postMessage({ type: 'videoFrame', data: { requestId: this.subscribe.requestId, frame } }, [frame]),
      error: (error: DOMException) => postMessage({ type: 'error', data: `VideoDecoder error: ${error.message}` }),
    });
    this.decoder.configure(VIDEO_DECODER_DEFAULT_CONFIG);
  }
  decode({ encodedVideoChunk, config }: { encodedVideoChunk: EncodedVideoChunk, config?: VideoDecoderConfig }) {
    if (config) {
      const isSupported = VideoDecoder.isConfigSupported(config);
      if (!isSupported) throw new Error(`Unsupported video decoder configuration: ${config}`);
      this.decoder.configure(config);
    }
    this.decoder.decode(encodedVideoChunk);
  }
}

const decoderInstance = new MoQTVideoDecoder();
self.addEventListener('message', decoderInstance.onMessage.bind(decoderInstance));

export {};
