import { Mastra } from '@mastra/core';

// Render entry. Agents and routes are registered here as they are built.
export const mastra = new Mastra({
  server: { host: process.env.MASTRA_HOST ?? 'localhost' }, // Render: MASTRA_HOST=0.0.0.0
});
