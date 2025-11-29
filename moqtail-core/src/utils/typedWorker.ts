/** A `Worker` with typed `postMessage`/`message` payloads. */
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

/** Constructor signature for a worker class (e.g., bundler-produced). */
export type WorkerFactory = { new (): Worker };

/**
 * Cast a worker constructor to a typed worker constructor to get
 * better type-safety when sending and receiving messages.
 */
export function createTypedWorker<In, Out>(
  WorkerCtor: WorkerFactory,
): { new (): TypedWorker<In, Out> } {
  return WorkerCtor as unknown as { new (): TypedWorker<In, Out> };
}
