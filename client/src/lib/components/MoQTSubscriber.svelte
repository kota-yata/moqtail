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

<div class="w-full flex flex-col items-center">
  <h3 class="text-lg font-semibold">Subscriber</h3>
  <video class="bg-gray-800 rounded" width={videoWidth} height={videoHeight} autoplay controls bind:this={videoEl}></video>
  <div class="w-full max-w-md space-y-2 mt-2">
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
      <label class="flex items-center gap-2" for="warp-catalog">
        <input type="checkbox" id="warp-catalog" bind:checked={warpCatalogEnabled} />
        Enable WARP Catalog
      </label>
    </div>
  </div>
  <div class="mt-2 space-y-2">
    <button on:click={connectToServer}>Connect to server</button>
    <button on:click={setup}>Setup</button>
    <button on:click={playStream}>Start playback</button>
    <button on:click={stopStream}>Stop playback</button>
  </div>
  
  {#if warpCatalogEnabled && catalog}
    <div class="mt-5 p-4 border border-gray-200 rounded bg-gray-50 w-full max-w-2xl">
      <h4 class="font-semibold">WARP Catalog (Version {catalog.version})</h4>
      <p class="text-sm text-gray-700">Delta Updates: {catalog.supportsDeltaUpdates ? 'Enabled' : 'Disabled'}</p>
      <p class="text-sm text-gray-700">Available Tracks: {availableTracks.length}</p>
      
      {#if availableTracks.length > 0}
        <div class="mt-2">
          <h5 class="font-medium">Tracks:</h5>
          {#each availableTracks as track}
            <div class="py-1 border-b border-gray-200 font-mono text-xs">
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
