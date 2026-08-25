import {
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { env } from "../config/env";

// Tracing setup. Local development prints spans to the console; production
// exports to Azure Monitor (Application Insights) when the connection
// string is present. Serverless note: instances can be frozen right after a
// response is sent, so the ask route force flushes at the end of every
// request instead of trusting a background batch interval.

const TRACER_NAME = "askops";

let provider: NodeTracerProvider | null = null;

export async function initTracing(): Promise<void> {
  if (provider) return;
  if (env.OTEL_EXPORTER === "none") return;

  const processors: SpanProcessor[] = [];
  if (env.OTEL_EXPORTER === "azure") {
    if (!env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      console.error(
        "OTEL_EXPORTER=azure requires APPLICATIONINSIGHTS_CONNECTION_STRING; tracing disabled",
      );
      return;
    }
    // Imported lazily so local dev never loads the Azure SDK.
    const { AzureMonitorTraceExporter } =
      await import("@azure/monitor-opentelemetry-exporter");
    processors.push(
      new BatchSpanProcessor(
        new AzureMonitorTraceExporter({
          connectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
        }),
      ),
    );
  } else {
    processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "askops" }),
    spanProcessors: processors,
  });
  provider.register();
}

export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

// Runs fn inside an active span, records errors, and always ends the span.
// With no provider registered (unit tests, OTEL_EXPORTER=none) the API
// falls back to a no op tracer and this becomes a plain function call.
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return getTracer().startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function currentTraceId(span: Span): string {
  return span.spanContext().traceId;
}

export async function forceFlushTracing(): Promise<void> {
  if (provider) {
    try {
      await provider.forceFlush();
    } catch (err) {
      console.error("trace flush failed", err);
    }
  }
}

// Test hook: register a custom processor (e.g. in memory exporter).
export function registerTestProvider(processor: SpanProcessor): void {
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "askops-test" }),
    spanProcessors: [processor],
  });
  provider.register();
}
