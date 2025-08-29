// src/utils/llm.ts
import { invoke } from "@tauri-apps/api/core";

export function stripCodeFences(s: string): string {
  return s
    .replace(/```json\s*([\s\S]*?)```/gi, "$1")
    .replace(/```([\s\S]*?)```/g, "$1")
    .trim();
}

export function extractJsonArrayStrict(text: string): string | null {
  const src = stripCodeFences(text);
  const start = src.indexOf("[");
  if (start === -1) return null;
  let depth = 0,
    inStr = false,
    esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

export function tryParseJsonArray<T = any>(raw: string): T[] | null {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {}
  const fixed = raw.replace(/,(\s*[}```])/g, "$1");
  try {
    const v = JSON.parse(fixed);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {}
  return null;
}

export function parseNumberedLinesToPairs(
  raw: string
): { id: number; translation: string }[] {
  const lines = stripCodeFences(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: { id: number; translation: string }[] = [];
  const rx = /^\s*(\d+)[\.```\:\-)]\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(rx);
    if (m) {
      const id = parseInt(m[1], 10);
      const translation = m[2] ?? "";
      if (!Number.isNaN(id)) result.push({ id, translation });
    }
  }
  if (!result.length) {
    const json = extractJsonArrayStrict(raw);
    if (json) {
      const arr = tryParseJsonArray<{ id: number; translation: string }>(json);
      if (arr) {
        return arr.filter(
          (x) => typeof x?.id === "number" && typeof x?.translation === "string"
        );
      }
    }
  }
  return result;
}

export async function chatCompletion(
  apiBaseUrl: string,
  model: string,
  system: string,
  user: string,
  temperature = 0.2
): Promise<string> {
  const apiUrl = `${apiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const resp = await invoke<any>("translate_text", {
    apiUrl,
    payload: {
      model: model || "local-model",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
      temperature,
      max_tokens: 1500,
    },
  });
  return resp?.choices?.[0]?.message?.content || "";
}
