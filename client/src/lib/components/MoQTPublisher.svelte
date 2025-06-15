<script lang="ts">
  import { AUDIO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_MOQMI_CONFIG, VIDEO_RESOLUTION_OPTIONS } from '$lib/config';
  import { Publisher } from '$lib/publisher';
  import { Mogger } from '$lib/utils/mogger';
  import { GROUP_ORDER } from 'moqtail';
  import { onMount } from 'svelte';

  let liveEl: HTMLVideoElement; // webcam preview
  let uploadEl: HTMLVideoElement; // uploaded video preview
  let publisherInit = false;
  let setupSent = false;
  let publisher: Publisher;
  let camStream: MediaStream;
  let uploadStream: MediaStream;
  let camStreaming = false;
  let uploadStreaming = false;

  const videoEncoders = {
    h264: VIDEO_ENCODER_MOQMI_CONFIG,
    vp8: VIDEO_ENCODER_DEFAULT_CONFIG
  };

  let videoEncoderChoice = 'vp8';

  const videoResolutions = VIDEO_RESOLUTION_OPTIONS;
  let videoResolutionChoice: keyof typeof videoResolutions = 'HD';

  let videoForwardingPreference: 'Subgroup' | 'KeyFrameStream' = 'Subgroup';

  export let moqtServerUrl: string;
  let namespace = ['moqtail'];
  let videoTrackName = 'video0';
  let audioTrackName = 'audio0';
  let uploadedVideoTrackName = 'video1';
  let uploadedAudioTrackName = 'audio1';
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

  const changeResolution = async () => {
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
    }
    camStream = await navigator.mediaDevices
      .getUserMedia({ video: videoResolutions[videoResolutionChoice], audio: true })
      .catch(() => {
        throw new Error('Error accessing media devices:');
      });
    setLiveVideo(camStream, liveEl);
  };

  const handleVideoUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const url = URL.createObjectURL(file);
    uploadEl.srcObject = null;
    uploadEl.src = url;
    // unmute temporarily to ensure the audio track is captured
    uploadEl.muted = false;
    await uploadEl.play();
    let capture = uploadEl.captureStream();
    // Firefox sometimes omits audio tracks when the element is muted
    if (capture.getAudioTracks().length === 0) {
      const audio = new Audio(url);
      audio.muted = true;
      await audio.play();
      capture.addTrack(audio.captureStream().getAudioTracks()[0]);
    }
    uploadStream = capture;
    // do not play the source audio locally
    uploadEl.muted = true;
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
  const startCamStreaming = () => {
    if (!publisherInit) return;
    publisher.announce(namespace);
    const videoEncoderConfig = {
      ...videoEncoders[videoEncoderChoice],
      ...videoResolutions[videoResolutionChoice],
    };
    if (camStream && !camStreaming) {
      const videoTrack: Track = {
        namespace,
        name: videoTrackName,
        type: 'video',
        objectForwardingPrefereces: videoForwardingPreference,
        encoderConfig: { encoderConfig: videoEncoderConfig, keyFrameDuration },
        groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
        subscribers: [],
        groups: [],
      };
      const at = camStream.getAudioTracks()[0];
      const settings = at.getSettings ? at.getSettings() : {};
      const audioEncoderConfig = {
        ...AUDIO_ENCODER_DEFAULT_CONFIG,
        ...(settings.sampleRate ? { sampleRate: settings.sampleRate } : {}),
        ...(settings.channelCount ? { numberOfChannels: settings.channelCount } : {}),
      } as AudioEncoderConfig;
      const audioTrack: Track = {
        namespace,
        name: audioTrackName,
        type: 'audio',
        objectForwardingPrefereces: 'Datagram',
        encoderConfig: { encoderConfig: audioEncoderConfig, keyFrameDuration },
        groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
        subscribers: [],
        groups: [],
        largestGroupId: -1,
        largestObjectId: -1,
      };
      const vt = camStream.getVideoTracks()[0];
      Mogger.info(`Streaming ${vt.label}`);
      publisher.startStream({ track: videoTrack, mediaTrack: vt });
      Mogger.info(`Streaming ${at.label}`);
      publisher.startStream({ track: audioTrack, mediaTrack: at });
      camStreaming = true;
    }
  };

  const startUploadStreaming = () => {
    if (!publisherInit || !uploadStream || uploadStreaming) return;
    const videoEncoderConfig = {
      ...videoEncoders[videoEncoderChoice],
      ...videoResolutions[videoResolutionChoice],
    };
    {
      const videoTrackFile: Track = {
        namespace,
        name: uploadedVideoTrackName,
        type: 'video',
        objectForwardingPrefereces: videoForwardingPreference,
        encoderConfig: { encoderConfig: videoEncoderConfig, keyFrameDuration },
        groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
        subscribers: [],
        groups: [],
      };
      const atf = uploadStream.getAudioTracks()[0];
      const settingsF = atf.getSettings ? atf.getSettings() : {};
      const audioEncoderConfigFile = {
        ...AUDIO_ENCODER_DEFAULT_CONFIG,
        ...(settingsF.sampleRate ? { sampleRate: settingsF.sampleRate } : {}),
        ...(settingsF.channelCount ? { numberOfChannels: settingsF.channelCount } : {}),
      } as AudioEncoderConfig;
      const audioTrackFile: Track = {
        namespace,
        name: uploadedAudioTrackName,
        type: 'audio',
        objectForwardingPrefereces: 'Datagram',
        encoderConfig: { encoderConfig: audioEncoderConfigFile, keyFrameDuration },
        groupOrderPublisherPreference: GROUP_ORDER.ASCENDING,
        subscribers: [],
        groups: [],
        largestGroupId: -1,
        largestObjectId: -1,
      };
      const vtF = uploadStream.getVideoTracks()[0];
      Mogger.info(`Streaming ${vtF.label}`);
      publisher.startStream({ track: videoTrackFile, mediaTrack: vtF });
      Mogger.info(`Streaming ${atf.label}`);
      publisher.startStream({ track: audioTrackFile, mediaTrack: atf });
      uploadStreaming = true;
    }
  };
  const stopStreaming = () => {
    if (!publisherInit) return;
    if (camStreaming) {
      publisher.stopStream(videoTrackName);
      publisher.stopStream(audioTrackName);
      camStreaming = false;
    }
    if (uploadStreaming) {
      publisher.stopStream(uploadedVideoTrackName);
      publisher.stopStream(uploadedAudioTrackName);
      uploadStreaming = false;
    }
  };

  onMount(async () => {
    await changeResolution();
    camera.inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
  });
</script>

<div class="pub">
  <h3>Publisher (Webcam capture)</h3>
  <div class="pub-video">
    <video autoplay muted playsinline controls bind:this={liveEl}></video>
    {#if camera.inputDevices}
      <select on:change={changeDevice}>
        {#each camera.inputDevices as device}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="pub-video">
    <video autoplay muted playsinline controls bind:this={uploadEl}></video>
  </div>
  <input class="file-upload" type="file" accept="video/*" on:change={handleVideoUpload} />
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
      <label for="pub-upload-video">Uploaded Video Track Name</label>
      <input type="text" name="pub-upload-video" bind:value={uploadedVideoTrackName} />
    </div>
    <div>
      <label for="pub-upload-audio">Uploaded Audio Track Name</label>
      <input type="text" name="pub-upload-audio" bind:value={uploadedAudioTrackName} />
    </div>
    <div>
      <label for="pub-track-keyframe-duration">Key Frame Duration {keyFrameDuration}</label>
      <input type="range" min="1" max="120" name="pub-track-keyframe-duration" bind:value={keyFrameDuration} />
    </div>
    <div>
      <label for="pub-track-video-forwarding">Video Forwarding</label>
      <select name="pub-track-video-forwarding" bind:value={videoForwardingPreference}>
        <option value="Subgroup">Stream (Subgroup)</option>
        <option value="KeyFrameStream">Key Frame Stream</option>
      </select>
    </div>
    <div>
      <label for="pub-track-video-resolution">Video Resolution</label>
      <select
        name="pub-track-video-resolution"
        bind:value={videoResolutionChoice}
        on:change={async () => await changeResolution()}
      >
        <option value="HD">HD (1280x720)</option>
        <option value="FullHD">Full HD (1920x1080)</option>
        <option value="4K">4K (3840x2160)</option>
      </select>
    </div>
    <div>
      <label for="pub-track-video-encoder-option">Video Encoder</label>
      <select name="pub-track-video-encoder-option" bind:value={videoEncoderChoice}>
        <option value="h264">H.264 (moq-mi)</option>
        <option value="vp8">VP8</option>
      </select>
    </div>
  </div>
  <button on:click={async () => await connectToServer()}>Connect to server</button>
  <button on:click={async () => setup()}>Setup</button>
  <button on:click={startCamStreaming}>Start camera streaming</button>
  <button on:click={startUploadStreaming}>Start file streaming</button>
  <button on:click={stopStreaming}>Stop streaming</button>
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
  .pub-video + .pub-video {
    margin-top: 10px;
  }
  .pub-video > select {
    position: absolute;
    bottom: 10px;
    left: 10px;
    border: none;
    padding: 5px 10px;
  }
  .file-upload {
    margin: 10px 0;
  }
</style>
