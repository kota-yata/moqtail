<script lang="ts">
  import { Subscriber } from '$lib/subscriber';
  import { GROUP_ORDER, type Subscribe, SUBSCRIBE_FILTER, SUBSCRIBE_FORWARD, WARP_CATALOG_TRACK_NAME } from 'moqtail';

  let videoEl: HTMLVideoElement;
  let moqIsPlaying = false;
  let subscriberInit = false;
  let subscriber: Subscriber;
  let setupSent = false;

  export let moqtServerUrl;
  export let videoWidth = 480;
  export let videoHeight = 360;
  let namespace = ['moqtail'];
  let videoTrackName = 'video0';
  let audioTrackName = 'audio0';
  let jitterBufferSize = 10;
  let warpCatalogEnabled = true;
  let availableTracks = [];
  let catalog = null;

  let requestId = -2; // Will become 0 after first increment
  const nextRequestId = () => {
    requestId += 2; // Client uses even Request IDs (0, 2, 4, 6, ...)
    return requestId;
  };

  // let videoQuality: 'low' | 'medium' | 'high' = 'low';

  const connectToServer = async () => {
    if (subscriberInit) return;
    subscriber = new Subscriber({
      serverUrl: moqtServerUrl,
      jitterBufferFrameSize: jitterBufferSize,
    });
    subscriberInit = true;
    subscriber.setVideoElement(videoEl);
    subscriber.setAudioContext();
    
    // Set up WARP catalog callbacks if enabled
    if (warpCatalogEnabled) {
      subscriber.warpCatalogManager.onCatalogUpdate((updatedCatalog) => {
        catalog = updatedCatalog;
      });
      
      subscriber.warpCatalogManager.onTrackUpdate((tracks) => {
        availableTracks = tracks;
      });
    }
  };
  const setup = () => {
    if (!subscriber || setupSent) return;
    subscriber.setup();
    setupSent = true;
    
    // Subscribe to WARP catalog if enabled
    if (warpCatalogEnabled) {
      const subscribeCatalog: Subscribe = {
        requestId: nextRequestId(),
        trackAlias: 242,
        trackNamespace: namespace,
        trackName: WARP_CATALOG_TRACK_NAME,
        subscriberPriority: 20,
        groupOrder: GROUP_ORDER.ASCENDING,
        forward: SUBSCRIBE_FORWARD.FORWARD,
        filterType: SUBSCRIBE_FILTER.LATEST_OBJECT,
      };
      subscriber.subscribe(subscribeCatalog, 'catalog');
    }
  };
  const playStream = () => {
    if (!subscriber || !setupSent) return;
    const subscribeVideo: Subscribe = {
      trackNamespace: namespace,
      trackName: videoTrackName,
      requestId: nextRequestId(),
      trackAlias: 243,
      subscriberPriority: 10,
      groupOrder: GROUP_ORDER.ASCENDING,
      forward: SUBSCRIBE_FORWARD.FORWARD,
      filterType: SUBSCRIBE_FILTER.LATEST_OBJECT,
    };
    subscriber.subscribe(subscribeVideo, 'video');
    const subscribeAudio: Subscribe = {
      trackNamespace: namespace,
      trackName: audioTrackName,
      requestId: nextRequestId(),
      trackAlias: 241,
      subscriberPriority: 1,
      groupOrder: GROUP_ORDER.ASCENDING,
      forward: SUBSCRIBE_FORWARD.FORWARD,
      filterType: SUBSCRIBE_FILTER.LATEST_OBJECT
    };
    subscriber.subscribe(subscribeAudio, 'audio');
  };
  const stopStream = () => {
    if (warpCatalogEnabled) {
      subscriber.unsubscribe(WARP_CATALOG_TRACK_NAME);
    }
    subscriber.unsubscribe(videoTrackName);
    subscriber.unsubscribe(audioTrackName);
    subscriber.stopAudio();
  };
</script>

<div class="sub">
  <h3>Subscriber</h3>
  <video width={videoWidth} height={videoHeight} autoplay controls bind:this={videoEl}></video>
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
      <label for="warp-catalog">
        <input type="checkbox" id="warp-catalog" bind:checked={warpCatalogEnabled} />
        Enable WARP Catalog
      </label>
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
  
  {#if warpCatalogEnabled && catalog}
    <div class="warp-catalog">
      <h4>WARP Catalog (Version {catalog.version})</h4>
      <p>Delta Updates: {catalog.supportsDeltaUpdates ? 'Enabled' : 'Disabled'}</p>
      <p>Available Tracks: {availableTracks.length}</p>
      
      {#if availableTracks.length > 0}
        <div class="tracks-list">
          <h5>Tracks:</h5>
          {#each availableTracks as track}
            <div class="track-item">
              <strong>{track.name}</strong>
              {#if track.codec}({track.codec}){/if}
              {#if track.width && track.height}
                - {track.width}x{track.height}
              {/if}
              {#if track.framerate}
                @ {track.framerate}fps
              {/if}
              {#if track.bitrate}
                - {Math.round(track.bitrate / 1000)}kbps
              {/if}
              {#if track.renderGroup !== undefined}
                - Render Group: {track.renderGroup}
              {/if}
              {#if track.altGroup !== undefined}
                - Alt Group: {track.altGroup}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .warp-catalog {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
  }
  
  .tracks-list {
    margin-top: 10px;
  }
  
  .track-item {
    padding: 5px 0;
    border-bottom: 1px solid #eee;
    font-family: monospace;
    font-size: 12px;
  }
  
  .track-item:last-child {
    border-bottom: none;
  }

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
</style>
