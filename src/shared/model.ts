import { createOllama } from 'ollama-ai-provider-v2';

// QUORUM_MODEL = 'google/gemma-4-26b-a4b-it' (Gemini API free tier, default after Gate 1)
//              | 'google/gemma-4-31b-it' | 'ollama:gemma4:e4b' (local, private)
export function quorumModel() {
  const m = process.env.QUORUM_MODEL ?? 'google/gemma-4-26b-a4b-it';
  if (!m.startsWith('ollama:')) return m; // Mastra model router string
  const ollama = createOllama({ baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api' });
  return ollama(m.slice('ollama:'.length)) as any; // AI SDK model object
}
