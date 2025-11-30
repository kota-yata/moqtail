<script>
  import { moqVideoTransmissionLatencyStore, bitrateStore } from '$lib/utils/store';
  import { Logger } from 'tslog';

  let cpuLoad = 'Compute Pressure API not supported';

  const logger = new Logger({ name: 'Statistics' });

  const pressureObserverCallback = (records) => {
    const lastRecord = records[records.length - 1];
    cpuLoad = lastRecord.state;
  };

  try {
    // @ts-ignore PressureObserver is not defined yet
    const observer = new PressureObserver(pressureObserverCallback);
    observer.observe('cpu', { sampleInterval: 1000, });
  } catch (error) {
    logger.error('PressureObserver not supported:', error);
  }
</script>

<div class="p-4 max-w-md mx-auto">
  <!-- <h3>Statistics</h3> -->
  <div class="text-sm">
    <div class="mb-2 min-w-[250px]"><span class="font-semibold">Transmission Latency:</span> {$moqVideoTransmissionLatencyStore}ms</div>
    <div class="mb-2 min-w-[250px]"><span class="font-semibold">CPU Load:</span> {cpuLoad}</div>
    <div class="mb-2 min-w-[250px]"><span class="font-semibold">Bitrate:</span> {($bitrateStore / 1_000_000).toFixed(2)} Mbps</div>
  </div>
</div>
