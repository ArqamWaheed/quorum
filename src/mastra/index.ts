import { Mastra } from '@mastra/core';
import { quorumAgent, quorumNoTools, quorumTry } from './agents/quorum';
import { routes } from './routes';

// Render entry. Render: MASTRA_HOST=0.0.0.0 (Mastra defaults to localhost).
export const mastra = new Mastra({
  agents: { quorumAgent, quorumNoTools, quorumTry },
  server: { host: process.env.MASTRA_HOST ?? 'localhost', apiRoutes: routes },
});
