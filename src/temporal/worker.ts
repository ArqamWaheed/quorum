import { NativeConnection, Worker } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import * as activities from './activities';
import { ensureIndexes } from '../shared/db';

await ensureIndexes().catch((e) => console.error('ensureIndexes:', e.message));
const connection = await NativeConnection.connect({ address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233' });
const worker = await Worker.create({
  connection, namespace: 'default', taskQueue: 'quorum', activities,
  workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)),
});
console.log('quorum worker: task queue "quorum"');
await worker.run();
