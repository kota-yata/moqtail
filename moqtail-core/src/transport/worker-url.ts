/**
 * Resolve the worker script URL relative to the current module.
 */
export function getTransportWorkerURL(): URL {
  return new URL('./worker.js', import.meta.url);
}
