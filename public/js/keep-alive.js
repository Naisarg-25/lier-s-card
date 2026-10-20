const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;

async function pingBackend() {
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`Backend health check failed with status ${response.status}.`);
    }
  } catch (error) {
    console.warn('Backend health check failed.', error);
  }
}

pingBackend();
setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);
