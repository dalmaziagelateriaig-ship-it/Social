export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { runDuePosts } = await import("./lib/social/publisher");
  // Checks every minute for scheduled posts while the server is running.
  // Online on a free plan the server sleeps: /api/cron, called by an external
  // scheduler, wakes it up and does the same check.
  setInterval(() => {
    runDuePosts().catch((e) => console.error("scheduler", e));
  }, 60_000);
}
