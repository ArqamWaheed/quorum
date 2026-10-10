import { MongoClient, type Db } from 'mongodb';
import type { RosterLine } from './schema';

let client: MongoClient | undefined;

// One client per process. M0 allows 500 connections, so keep the pool small.
export async function db(): Promise<Db> {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  client ??= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 10_000 });
  await client.connect(); // no-op if connected
  return client.db(process.env.MONGODB_DB ?? 'quorum');
}

export async function roster(chatId: string): Promise<RosterLine[]> {
  const ms = await (await db()).collection('members').find({ chatId }).toArray();
  return ms.map((m) => ({ name: m.name as string, constraints: (m.constraints ?? []).map((c: any) => c.text) }));
}

export async function logEvent(planId: string, type: string, detail: string) {
  await (await db()).collection<any>('plans').updateOne(
    { _id: planId },
    { $push: { events: { at: new Date(), type, detail } } } as any,
    { upsert: true },
  );
}

// Normal indexes only (no search indexes: M0 allows 3 and Mastra needs one).
export async function ensureIndexes() {
  const d = await db();
  await d.collection('serp_cache').createIndex({ fetchedAt: 1 }, { expireAfterSeconds: 43_200 });
  await d.collection('members').createIndex({ chatId: 1 });
  await d.collection('plans').createIndex({ chatId: 1, status: 1 });
  await d.collection('polls').createIndex({ planId: 1 });
  await d.collection('try_hits').createIndex({ at: 1 }, { expireAfterSeconds: 3_600 });
}
