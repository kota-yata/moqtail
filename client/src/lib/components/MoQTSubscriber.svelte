<script lang="ts">
  import { Subscriber } from '$lib/subscriber';
  import { GROUP_ORDER, type Subscribe, SUBSCRIBE_FILTER } from 'moqtail';

  let videoEl: HTMLVideoElement;
  let moqIsPlaying = false;
  let subscriberInit = false;
  let subscriber: Subscriber;
  let setupSent = false;
  let asciiEl: HTMLElement;

  export let moqtServerUrl;
  export let videoWidth = 480;
  export let videoHeight = 360;
  let namespace = ['moqtail'];
  let videoTrackName = 'video0';
  let audioTrackName = 'audio0';
  let jitterBufferSize = 10;

  // let videoQuality: 'low' | 'medium' | 'high' = 'low';

  const connectToServer = async () => {
    if (subscriberInit) return;
    subscriber = new Subscriber({
      serverUrl: moqtServerUrl,
      jitterBufferFrameSize: jitterBufferSize,
    });
    subscriberInit = true;
    subscriber.setVideoElement(videoEl);
    subscriber.setAsciiElement(asciiEl);
    subscriber.setAudioContext();
  };
  const setup = () => {
    if (!subscriber || setupSent) return;
    subscriber.setup();
    setupSent = true;
  };
  const playStream = () => {
    if (!subscriber || !setupSent) return;
    const subscribeVideo: Subscribe = {
      trackNamespace: namespace,
      trackName: videoTrackName,
      subscribeId: 0,
      trackAlias: 243,
      subscriberPriority: 10,
      groupOrder: GROUP_ORDER.ASCENDING,
      filterType: SUBSCRIBE_FILTER.LATEST_OBJECT,
    };
    subscriber.subscribe(subscribeVideo, 'video');
    const subscribeAudio: Subscribe = {
      trackNamespace: namespace,
      trackName: audioTrackName,
      subscribeId: 1,
      trackAlias: 241,
      subscriberPriority: 1,
      groupOrder: GROUP_ORDER.ASCENDING,
      filterType: SUBSCRIBE_FILTER.LATEST_OBJECT
    };
    subscriber.subscribe(subscribeAudio, 'audio');
  };
  const stopStream = () => {
    subscriber.unsubscribe(videoTrackName);
    subscriber.unsubscribe(audioTrackName);
    subscriber.stopAudio();
  };
</script>

<div class="sub">
  <h3>Subscriber</h3>
  <video width={videoWidth} height={videoHeight} autoplay controls bind:this={videoEl}></video>
  <pre class="ascii" bind:this={asciiEl}></pre>
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
      <!-- <label for="pub-track-jitter">Jitter Buffer {jitterBufferSize}ms</label> -->
      <!-- <input
        type="range"
        min="0"
        max="60"
        step="10"
        name="pub-track-jitter"
        bind:value={jitterBufferSize}
      /> -->
    </div>
  </div>
  <button on:click={connectToServer}>Connect to server</button>
  <button on:click={setup}>Setup</button>
  <button on:click={playStream}>Start playback</button>
  <button on:click={stopStream}>Stop playback</button>
</div>

<style>
  .sub {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    align-items: center;
  }
  video {
    background-color: #333;
  }
  .ascii {
    font-family: monospace;
    line-height: 1;
    white-space: pre;
  }
</style>
