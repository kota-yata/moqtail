export function frameToAscii(frame: VideoFrame, width: number, height: number): string {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(frame as any, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const chars = ' .:-=+*#%@';
  let result = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const index = Math.floor((brightness / 255) * (chars.length - 1));
      result += chars[index];
    }
    result += '\n';
  }
  return result;
}
