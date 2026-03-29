export async function register() {
  // Only run in Node.js server runtime, not Edge or client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const runScheduler = async () => {
      try {
        await fetch(`${baseUrl}/api/scheduler/run`, { method: "POST" });
      } catch {
        // Scheduler fetch failed — server may still be starting up, will retry next tick
      }
    };

    // Wait for server to be ready, then start the scheduler loop
    setTimeout(() => {
      runScheduler(); // fire immediately on startup
      setInterval(runScheduler, 60 * 1000); // then every 60 seconds
    }, 5000);

    console.log("[FlowMake] Scheduler started — checking every 60s");
  }
}
