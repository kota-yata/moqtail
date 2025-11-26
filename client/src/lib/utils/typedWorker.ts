// Generic typed Worker wrapper utilities (mirrors vv-player)

export type TypedWorker<In, Out> = Omit<Worker, 'postMessage' | 'addEventListener' | 'removeEventListener' | 'onmessage'> & {
  postMessage(message: In, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (this: Worker, ev: MessageEvent<Out>) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'message',
    listener: (this: Worker, ev: MessageEvent<Out>) => any,
    options?: boolean | EventListenerOptions
  ): void;
  onmessage: ((this: Worker, ev: MessageEvent<Out>) => any) | null;
};

export type WorkerFactory = { new (): Worker };

export function createTypedWorker<In, Out>(
  WorkerCtor: WorkerFactory,
): { new (): TypedWorker<In, Out> } {
  return WorkerCtor as unknown as { new (): TypedWorker<In, Out> };
}

