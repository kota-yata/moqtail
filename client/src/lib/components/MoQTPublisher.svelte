<script lang="ts">
  import { AUDIO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_DEFAULT_CONFIG, VIDEO_ENCODER_MOQMI_CONFIG, VIDEO_RESOLUTION_OPTIONS } from '$lib/config';
  import { Publisher } from '$lib/publisher';
  import { Logger } from 'tslog';
  import { GROUP_ORDER } from 'moqtail';
  import { onMount } from 'svelte';

  let liveEl: HTMLVideoElement;
  let publisherInit = false;
  let setupSent = false;
  let publisher: Publisher;
  let stream: MediaStream;

  const logger = new Logger({ name: 'MoQTPublisher' });

  const videoEncoders = {
    h264: VIDEO_ENCODER_MOQMI_CONFIG,
    vp8: VIDEO_ENCODER_DEFAULT_CONFIG
  };

  let videoEncoderChoice = 'vp8';

  const videoResolutions = VIDEO_RESOLUTION_OPTIONS;
  let videoResolutionChoice: keyof typeof videoResolutions = 'HD';

  let videoForwardingPreference: 'Subgroup' = 'Subgroup';

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

  const changeResolution = async () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    stream = await navigator.mediaDevices
      .getUserMedia({ video: videoResolutions[videoResolutionChoice], audio: true })
      .catch(() => {
        throw new Error('Error accessing media devices:');
      });
    setLiveVideo(stream, liveEl);
  };

  const handleVideoUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const url = URL.createObjectURL(file);
    liveEl.srcObject = null;
    liveEl.src = url;
    // unmute temporarily to ensure the audio track is captured
    liveEl.muted = false;
    await liveEl.play();
    let capture = liveEl.captureStream();
    // Firefox sometimes omits audio tracks when the element is muted
    if (capture.getAudioTracks().length === 0) {
      const audio = new Audio(url);
      audio.muted = true;
      await audio.play();
      capture.addTrack(audio.captureStream().getAudioTracks()[0]);
    }
    stream = capture;
    // replace the video and audio tracks in the publisher
    if (publisherInit) {
      const vt = stream.getVideoTracks()[0];
      if (vt) publisher.replaceMediaTrack(videoTrackName, vt);
      const at = stream.getAudioTracks()[0];
      if (at) publisher.replaceMediaTrack(audioTrackName, at);
    }
    // do not play the source audio locally
    liveEl.muted = true;
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
    
    const vt = stream.getVideoTracks()[0];
    const videoEncoderConfig = {
      ...videoEncoders[videoEncoderChoice],
      ...videoResolutions[videoResolutionChoice],
    };
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
    
    const at = stream.getAudioTracks()[0];
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

    // Add tracks using WARP-aware methods
    publisher.addWarpTrack(videoTrack);
    publisher.addWarpTrack(audioTrack);
    
    // Initialize and publish WARP catalog
    publisher.initializeWarpCatalog();
    
    logger.info(`Streaming ${vt.label}`);
    publisher.startStream({ track: videoTrack, mediaTrack: vt });
    logger.info(`Streaming ${at.label}`);
    publisher.startStream({ track: audioTrack, mediaTrack: at });
  };
  const stopStreaming = () => {
    if (!publisherInit) return;
    
    // Remove tracks using WARP-aware methods
    publisher.removeWarpTrack(videoTrackName);
    publisher.removeWarpTrack(audioTrackName);
    
    // Terminate WARP session
    publisher.terminateWarpSession();
    
    publisher.stopStream(videoTrackName);
    publisher.stopStream(audioTrackName);
    // publisher.unannounce(namespace);
    publisherInit = false;
  };

  onMount(async () => {
    await changeResolution();
    camera.inputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );
  });
</script>

<div class="w-full flex flex-col items-center">
  <h3 class="text-lg font-semibold">Publisher (Webcam capture)</h3>
  <div class="relative w-full">
    <video class="object-contain w-full" autoplay muted playsinline controls bind:this={liveEl}></video>
    {#if camera.inputDevices}
      <select class="absolute bottom-2 left-2 px-3 py-1 rounded bg-white/80" on:change={changeDevice}>
        {#each camera.inputDevices as device}
          <option value={device.deviceId}>{device.label}</option>
        {/each}
      </select>
    {/if}
  </div>
  <input class="my-2" type="file" accept="video/*" on:change={handleVideoUpload} />
  <div class="w-full max-w-md space-y-2">
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-namespace">Track Namespace</label>
      <input class="flex-1" type="text" name="pub-track-info-namespace" bind:value={namespace} />
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-video">Video Track Name</label>
      <input class="flex-1" type="text" name="pub-track-video" bind:value={videoTrackName} />
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-audio">Audio Track Name</label>
      <input class="flex-1" type="text" name="pub-track-audio" bind:value={audioTrackName} />
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-keyframe-duration">Key Frame Duration {keyFrameDuration}</label>
      <input class="flex-1" type="range" min="1" max="120" name="pub-track-keyframe-duration" bind:value={keyFrameDuration} />
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-video-forwarding">Video Forwarding</label>
      <select class="flex-1" name="pub-track-video-forwarding" bind:value={videoForwardingPreference}>
        <option value="Subgroup">Stream</option>
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-video-resolution">Video Resolution</label>
      <select
        class="flex-1"
        name="pub-track-video-resolution"
        bind:value={videoResolutionChoice}
        on:change={async () => await changeResolution()}
      >
        <option value="SD">SD (853x480)</option>
        <option value="HD">HD (1280x720)</option>
        <option value="FullHD">Full HD (1920x1080)</option>
        <option value="4K">4K (3840x2160)</option>
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="min-w-[140px]" for="pub-track-video-encoder-option">Video Encoder</label>
      <select class="flex-1" name="pub-track-video-encoder-option" bind:value={videoEncoderChoice}>
        <option value="h264">H.264 (moq-mi)</option>
        <option value="vp8">VP8</option>
      </select>
    </div>
  </div>
  <div class="mt-2 space-y-2">
    <button on:click={async () => await connectToServer()}>Connect to server</button>
    <button on:click={async () => setup()}>Setup</button>
    <button on:click={async () => startStreaming()}>Start streaming</button>
    <button on:click={async () => stopStreaming()}>Stop streaming</button>
  </div>
</div>
