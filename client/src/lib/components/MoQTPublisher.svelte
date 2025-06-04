<script lang="ts">
  import { AUDIO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_MOQMI_CONFIG } from '$lib/config';
  import { Publisher } from '$lib/publisher';
  import { Mogger } from '$lib/utils/mogger';
  import { GROUP_ORDER } from 'moqtail';
  import { onMount } from 'svelte';

  let liveEl: HTMLVideoElement;
  let publisherInit = false;
  let setupSent = false;
  let publisher: Publisher;
  let stream: MediaStream;

  const videoEncoders = {
    h264: VIDEO_ENCODER_MOQMI_CONFIG,
    vp8: VIDEO_ENCODER_DEFAULT_CONFIG
  };

  let videoEncoderChoice = 'vp8';

  let videoForwardingPreference: 'Subgroup' | 'Datagram' = 'Subgroup';

  export let moqtServerUrl: string;
  let namespace = ['moqtail'];
  let videoTrackName = 'video0';
  let audioTrackName = 'audio0';
  let keyFrameDuration = 30;

  const camera = {
    inputDevices: null as MediaDeviceInfo[],
    selectedDevice: null as string
  };

  const changeDevice = async (e) => {
    // const newStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: e.target.value } } });
    // stream.removeTrack(stream.getVideoTracks()[0]);
    // stream.addTrack(newStream.getVideoTracks()[0]);
    // setLiveVideo(newStream, liveEl);
    // if (!publisher) return;
    // publisher.replaceTrack(stream);
  };

  const setLiveVideo = async (stream: MediaStream, videoEl: HTMLVideoElement): Promise<MediaStream> => {
    if (!stream) throw new Error('Failed retrieving media devices');
    videoEl.srcObject = stream;
    return stream;
  };
  const connectToServer = async () => {
    if (publisherInit) return;
    publisher = new Publisher({ serverUrl: moqtServerUrl });
    publisherInit = true;
  };
  const setup = () => {
    if (!publisherInit || setupSent) return;
    publisher.setup();
    setupSent = true;
  };
  const startStreaming = () => {
    if (!publisherInit) return;
    publisher.announce(namespace);
    const videoTrack: Track = {
      namespace,
      name: videoTrackName,
      type: 'video',
      objectForwardingPrefereces: videoForwardingPreference,
      encoderConfig: { encoderConfig: videoEncoders[videoEncoderChoice], keyFrameDuration },
      groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
      subscribers: [],
      groups: [],
    };
    const audioTrack: Track = {
      namespace,
      name: audioTrackName,
      type: 'audio',
      objectForwardingPrefereces: 'Datagram',
      encoderConfig: { encoderConfig: AUDIO_ENCODER_DEFAULT_CONFIG, keyFrameDuration },
      groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
      subscribers: [],
      groups: [],
      largestGroupId: -1,
      largestObjectId: -1,
    };
    const vt = stream.getVideoTracks()[0];
    Mogger.info(`Streaming ${vt.label}`);
    publisher.startStream({ track: videoTrack, mediaTrack: vt });
    const at = stream.getAudioTracks()[0];
    Mogger.info(`Streaming ${at.label}`);
    publisher.startStream({ track: audioTrack, mediaTrack: at });
  };
  const stopStreaming = () => {
    if (!publisherInit) return;
    publisher.stopStream(videoTrackName);
    publisher.stopStream(audioTrackName);
    // publisher.unannounce(namespace);
    publisherInit = false;
  };

  onMount(async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {
      throw new Error('Error accessing media devices:');
    });
    camera.inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
    setLiveVideo(stream, liveEl);
  });
</script>

<div class="pub">
  <h3>Publisher (Webcam capture)</h3>
  <div class="pub-video">
    <video autoplay muted playsinline bind:this={liveEl} />
    {#if camera.inputDevices}
      <select on:change={changeDevice}>
        {#each camera.inputDevices as device}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="track">
    <div>
      <label for="pub-track-namespace">Track Namespace</label>
      <input type="text" name="pub-track-info-namespace" bind:value={namespace} />
    </div>
    <div>
      <label for="pub-track-video">Video Track Name</label>
      <input type="text" name="pub-track-video" bind:value={videoTrackName} />
    </div>
    <div>
      <label for="pub-track-audio">Audio Track Name</label>
      <input type="text" name="pub-track-audio" bind:value={audioTrackName} />
    </div>
    <div>
      <label for="pub-track-keyframe-duration">Key Frame Duration {keyFrameDuration}</label>
      <input type="range" min="1" max="120" name="pub-track-keyframe-duration" bind:value={keyFrameDuration} />
    </div>
    <div>
      <label for="pub-track-video-forwarding">Video Forwarding</label>
      <select name="pub-track-video-forwarding" bind:value={videoForwardingPreference}>
        <option value="Subgroup">Stream (Subgroup)</option>
        <option value="Datagram">Datagram</option>
      </select>
    </div>
    <div>
      <label for="pub-track-video-encoder-option">Video Encoder</label>
      <select name="pub-track-video-encoder-option" bind:value={videoEncoderChoice}>
        <option value="h264">H.264 (moq-mi)</option>
        <option value="vp8">VP8</option>
    </div>
  </div>
  <button on:click={async () => await connectToServer()}>Connect to server</button>
  <button on:click={async () => setup()}>Setup</button>
  <button on:click={async () => startStreaming()}>Start streaming</button>
  <button on:click={async () => stopStreaming()}>Stop streaming</button>
</div>

<style>
  .pub {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
  }
  .pub-video {
    position: relative;
  }
  .pub-video > video {
    object-fit: contain;
  }
  .pub-video > select {
    position: absolute;
    bottom: 10px;
    left: 10px;
    border: none;
    padding: 5px 10px;
  }
  
  .track > div {
    margin: 5px;
  }
</style>
