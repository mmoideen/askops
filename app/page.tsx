"use client";

import { useState } from "react";

interface Source {
  ref: number;
  chunkId: number;
  docId: string;
  title: string;
  similarity: number;
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer ?? "Error: no answer returned");
      setSources(data.sources ?? []);
    } catch {
      setAnswer("Request failed. Is the database running and ingested?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>AskOps</h1>
      <p>Ask a question about internal ops docs.</p>
      <form onSubmit={ask}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How do I set up the VPN?"
          style={{ width: "70%", padding: 8, marginRight: 8 }}
        />
        <button type="submit" disabled={loading || question.length === 0}>
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>
      {answer && (
        <div style={{ marginTop: 24 }}>
          <h2>Answer</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12 }}>{answer}</pre>
          {sources.length > 0 && (
            <>
              <h3>Sources</h3>
              <ul>
                {sources.map((s) => (
                  <li key={s.chunkId}>
                    [{s.ref}] {s.title} ({s.docId}, chunk {s.chunkId}, score{" "}
                    {s.similarity.toFixed(3)})
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}
