/**
 * Resolve the worker script URL relative to the current module.
 */
export function getTransportWorkerURL(): URL {
  // Use the bundled single-file worker for robust loading from external apps
  return new URL('./worker.bundle.js', import.meta.url);
}
