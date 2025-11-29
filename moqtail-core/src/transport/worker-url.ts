export function getTransportWorkerURL(): URL {
  return new URL('./worker.js', import.meta.url);
}

