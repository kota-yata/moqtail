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

<div class="statistics">
  <!-- <h3>Statistics</h3> -->
  <div class="stat-text">
    <div class="stat-item">
      <span class="stat-label">Transmission Latency:</span>
      <span class="stat-value">{$moqVideoTransmissionLatencyStore}ms</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">CPU Load:</span>
      <span class="stat-value">{cpuLoad}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Bitrate:</span>
      <span class="stat-value">{($bitrateStore / 1_000_000).toFixed(2)} Mbps</span>
    </div>
  </div>
</div>

<style>
  .statistics {
    padding: 1rem;
    max-width: 500px;
    margin: 0 auto;
  }

  .stat-item {
    margin-bottom: 0.5rem;
    min-width: 250px;
  }

  .stat-label {
    font-weight: bold;
    min-width: 250px;
  }
</style>
