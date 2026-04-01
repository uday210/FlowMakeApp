export async function register() {
  // NEXT_RUNTIME is set by Next.js — "nodejs" for the server runtime, "edge" for edge functions.
  // Guard against edge/client runtime. Also skip if explicitly disabled.
  if (process.env.NEXT_RUNTIME === "edge") return;

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
    console.log("[FlowMake] Scheduler started — polling every 60s");
  }, 5000);
}
