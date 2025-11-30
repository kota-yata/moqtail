<script lang="ts">
  import MoQTSubscriber from '$lib/components/MoQTSubscriber.svelte';
  import MoQTPublisher from '$lib/components/MoQTPublisher.svelte';
  import GenericInput from '$lib/components/GenericInput.svelte';
  import Statistics from '$lib/components/Statistics.svelte';

  let moqtServerUrl = 'https://tcam.kota-yata.com:4433/moq';
  // let moqtServerUrl = 'https://fb.mvfst.net:9448/moq-relay';
  // let moqtServerUrl = 'https://31.133.145.159:9000'
</script>

<svelte:head>
  <title>Moqtail Demo • Video Call over MoQT</title>
  <meta name="description" content="Live demo of Moqtail webcam streaming over MoQT." />
</svelte:head>

<!-- svelte-ignore a11y-media-has-caption -->
<div class="w-full mx-auto p-4 flex flex-col items-center">
  <h1 class="text-2xl font-semibold mb-2">Webcam Streaming Demo</h1>
  <div class="w-full my-1">
    <GenericInput key="Relay Server" bind:defaultVal={moqtServerUrl} />
  </div>
  <p class="text-sm text-gray-600 text-center">
    Note that the default server URL does not always work because I turn the process up only when I need to.<br />
    If it happens to work, you have a nice day.
  </p>
  <div class="w-full max-w-3xl my-2">
    <Statistics />
  </div>
  <div class="flex flex-wrap gap-5 justify-center">
    <div class="flex-1 min-w-[300px] max-w-[500px]">
      <MoQTPublisher {moqtServerUrl} />
    </div>
    <div class="flex-1 min-w-[300px] max-w-[500px]">
      <MoQTSubscriber {moqtServerUrl} videoWidth={480} videoHeight={360} />
    </div>
  </div>
</div>
