import Conference from './index';

const startBtn = document.getElementById('start') as HTMLButtonElement;
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
const remoteCanvas = document.getElementById('remoteCanvas') as HTMLCanvasElement;
const ctx = remoteCanvas.getContext('2d');

const conf = new Conference(window.location.origin);

startBtn.onclick = async () => {
  await conf.connect();
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  localVideo.srcObject = stream;
  await conf.publish(stream);
};

conf.onRemoteFrame = (frame: VideoFrame) => {
  if (ctx) {
    // draw frame to canvas and close
    // @ts-ignore drawImage accepts VideoFrame in modern browsers
    ctx.drawImage(frame, 0, 0);
  }
  frame.close();
};

export {};
