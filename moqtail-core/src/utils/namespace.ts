import { varBytesToString, deserializeQuicVarInt, stringToVarBytes } from 'bytes';

export const deserializeNamespace = async (stream: ReadableStream): Promise<string[]> => {
  const namespaceLength = await deserializeQuicVarInt(stream);
  const namespace: string[] = [];
  for (let i = 0; i < namespaceLength; i++) {
    namespace.push(await varBytesToString(stream));
  }
  return namespace;
}

export const validateFullTrackName = (trackNamespace: string[], trackName: string): void => {
  // Calculate total length: sum of namespace fields + track name
  let totalLength = 0;
  
  // Add namespace field lengths (including length prefixes)
  for (const field of trackNamespace) {
    const fieldBytes = stringToVarBytes(field);
    totalLength += fieldBytes.length;
  }
  
  // Add track name length (including length prefix)
  const trackNameBytes = stringToVarBytes(trackName);
  totalLength += trackNameBytes.length;
  
  if (totalLength > 4096) {
    throw new Error(`Full Track Name exceeds maximum length of 4096 bytes (current: ${totalLength})`);
  }
};
