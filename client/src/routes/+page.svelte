<script lang="ts">
  import MoQTSubscriber from '$lib/components/MoQTSubscriber.svelte';
  import MoQtPublisher from '$lib/components/MoQTPublisher.svelte';
  import GenericInput from '$lib/components/GenericInput.svelte';
  import Statistics from '$lib/components/Statistics.svelte';

  let moqtServerUrl = 'https://tcam.kota-yata.com:4433/moq';
  // let moqtServerUrl = 'https://fb.mvfst.net:9448/moq-relay';
  // let moqtServerUrl = 'https://31.133.145.159:9000'
</script>

<svelte:head>
  <title>Video Call over MoQT</title>
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="container">
  <h1>Webcam Streaming Demo</h1>
  <div class="relay-server">
    <GenericInput key="Relay Server" bind:defaultVal={moqtServerUrl} />
  </div>
  <div class="container-statistics">
    <Statistics />
  </div>
  <div class="container-videos">
    <div class="left">
      <MoQtPublisher {moqtServerUrl} />
    </div>
    <div class="right">
      <MoQTSubscriber {moqtServerUrl} videoWidth={480} videoHeight={360} />
      <MoQTSubscriber
        {moqtServerUrl}
        videoWidth={480}
        videoHeight={360}
        videoTrackName="video1"
        audioTrackName="audio1"
      />
    </div>
  </div>
</div>

<style>
  .container {
    width: 100%;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .container-videos {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
  }
  .container-videos > div {
    flex: 1;
    min-width: 300px;
    max-width: 500px;
  }

  .relay-server {
    margin: 5px;
    width: 100%;
  }
</style>
