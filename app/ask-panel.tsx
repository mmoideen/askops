"use client";

import { useState } from "react";

interface SourceRef {
  ref: number;
  chunkId: number;
  docId: string;
  title: string;
  similarity: number;
}

interface AskResponse {
  answer: string;
  refused: boolean;
  sources: SourceRef[];
  citedChunkIds: number[];
  meta?: { model: string; totalMs: number; traceId?: string };
  error?: string;
}

export function AskPanel({ role }: { role: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as AskResponse;
      if (!res.ok) {
        setError(data.error ?? `Request failed with status ${res.status}`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const citedSet = new Set(result?.citedChunkIds ?? []);

  return (
    <section>
      <p className="hint">
        Your role is <strong>{role}</strong>. Answers only draw from documents
        your role is allowed to see.
      </p>
      <form onSubmit={ask} className="ask-form">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How do I set up the GlobalConnect VPN?"
          maxLength={2000}
          aria-label="Question"
        />
        <button
          type="submit"
          className="button primary"
          disabled={loading || question.trim().length < 3}
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>

      {error && <p className="warning">{error}</p>}

      {result && (
        <div className="result">
          <h2>{result.refused ? "No answer available" : "Answer"}</h2>
          <div className="answer">{result.answer}</div>
          {result.sources.length > 0 && (
            <>
              <h3>Sources</h3>
              <ul className="sources">
                {result.sources.map((s) => (
                  <li key={s.chunkId}>
                    <span className="ref">[{s.ref}]</span> {s.title}{" "}
                    <span className="meta">
                      ({s.docId}, relevance {s.similarity.toFixed(2)})
                    </span>
                    {citedSet.has(s.chunkId) && (
                      <span className="cited-badge">cited</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.meta && (
            <p className="request-meta">
              {result.meta.model}, {result.meta.totalMs} ms
              {result.meta.traceId ? `, trace ${result.meta.traceId}` : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
