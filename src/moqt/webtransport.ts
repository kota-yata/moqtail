export class WebTransportManager {
  private wt: WebTransport;
  private controlStream: WebTransportBidirectionalStream;
  private controlWriter: WritableStream;
  private controlReader: ReadableStream;

  constructor(url: string) {
    this.wt = new WebTransport(url);
  }

  public async initControlStream() {
    await this.wt.ready;
    this.controlStream = await this.wt.createBidirectionalStream();
    this.controlWriter = this.controlStream.writable;
    this.controlReader = this.controlStream.readable;
  }

  public getIncomingStream(): ReadableStream {
    return this.wt.incomingUnidirectionalStreams;
  }

  public getControlWriter(): WritableStream {
    return this.controlWriter;
  }

  public getControlReader(): ReadableStream {
    return this.controlReader;
  }
}
