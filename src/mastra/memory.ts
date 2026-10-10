import { Memory } from '@mastra/memory';
import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

// resource = chat:<chatId>. Threads: roster:<chatId> (every /me), plan:<chatId>:<date>, recap:<chatId>:<date>.
// scope 'resource' lets next week's draft recall a /me from weeks ago and last Sunday's recap.
// Mastra creates the vector index itself: 1 of the 3 search/vector indexes M0 allows. Don't add others.
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'quorum';
const recall = process.env.SEMANTIC_RECALL !== 'off';

export const memory = uri
  ? new Memory({
      storage: new MongoDBStore({ id: 'quorum-store', uri, dbName }),
      ...(recall
        ? {
            vector: new MongoDBVector({ id: 'quorum-vector', uri, dbName }), // Atlas Vector Search
            embedder: new ModelRouterEmbeddingModel('google/gemini-embedding-001'), // same key as Gemma
          }
        : {}),
      options: {
        lastMessages: 20,
        semanticRecall: recall ? { topK: 4, messageRange: 1, scope: 'resource' } : false,
      },
    })
  : undefined; // no Atlas configured: agent runs stateless (smoke test, local dev)
