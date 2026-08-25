import { z } from "zod";

// Input validation, prompt injection heuristics, and PII redaction for logs.
// The heuristics do not block requests on their own (false positives would
// make the tool useless); they flag the request so the audit log records the
// attempt, and the layered defenses (SQL scoped retrieval, hardened system
// prompt, delimited context) do the actual containment.

export const askRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Question must be at least 3 characters")
    .max(2000, "Question must be at most 2000 characters"),
});

export type AskRequest = z.infer<typeof askRequestSchema>;

const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts)/i, label: "ignore-previous-instructions" },
  { pattern: /disregard\s+(all\s+|any\s+)?(previous|prior|above|earlier|your)\s+(instructions|rules|guidelines)/i, label: "disregard-instructions" },
  { pattern: /reveal\s+(your\s+)?(system\s+prompt|instructions|initial\s+prompt)/i, label: "reveal-system-prompt" },
  { pattern: /(show|print|repeat|output|display)\s+(me\s+)?(your\s+)?(system\s+prompt|hidden\s+instructions|initial\s+instructions)/i, label: "show-system-prompt" },
  { pattern: /you\s+are\s+now\s+(in\s+)?(developer|dan|jailbreak|unrestricted|admin)\s*(mode)?/i, label: "role-override" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|unrestricted)/i, label: "pretend-role" },
  { pattern: /act\s+as\s+(if\s+you\s+(have|are)|an?\s+(admin|root|unrestricted))/i, label: "act-as-privileged" },
  { pattern: /bypass\s+(the\s+)?(rules|restrictions|filters|guardrails|rbac|access\s+controls?)/i, label: "bypass-controls" },
  { pattern: /\b(do\s+anything\s+now|dan\s+mode)\b/i, label: "dan" },
  { pattern: /(without|regardless\s+of)\s+(my\s+|the\s+)?(role|permission|authorization|access\s+level)/i, label: "ignore-authorization" },
  { pattern: /(restricted|classified|confidential)\s+(documents?|content|chunks?|data).{0,40}(anyway|regardless|even\s+though)/i, label: "restricted-exfil" },
  { pattern: /<\/?(system|assistant|instructions?)>/i, label: "fake-delimiters" },
];

export interface InjectionVerdict {
  flagged: boolean;
  labels: string[];
}

export function detectInjection(text: string): InjectionVerdict {
  const labels: string[] = [];
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      labels.push(label);
    }
  }
  return { flagged: labels.length > 0, labels };
}

// Redaction for persisted logs and audit entries. Order matters: emails
// before phone-like digit runs so an email's digits are not half redacted.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_RE =
  /(\+?1[\s.-]?)?(\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10}\b/g;
const CREDIT_CARD_RE = /\b(?:\d[ -]?){13,16}\b/g;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(SSN_RE, "[REDACTED_SSN]")
    .replace(CREDIT_CARD_RE, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 16
        ? "[REDACTED_CARD]"
        : match;
    })
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}
