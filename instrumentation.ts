// Next.js instrumentation hook. Runs once per server instance start, before
// any request handling. Tracing only initializes in the Node.js runtime;
// the edge runtime (middleware) stays instrumentation free.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTracing } = await import("./src/observability/otel");
    await initTracing();
  }
}
