import { z } from 'zod';

export const PlanOption = z.object({
  title: z.string().max(90), // must fit a Discord select-menu label (100 chars)
  where: z.string().describe('exact name returned by the places tool'),
  start: z.string().describe('HH:MM local'),
  durationH: z.number().min(1).max(4),
  shapedBy: z.array(z.string()).describe('roster constraints that changed this option'),
  weatherNote: z.string(),
});
export const PlanOptions = z.object({ options: z.array(PlanOption).min(2).max(3) });
export type Option = z.infer<typeof PlanOption>;
export type RosterLine = { name: string; constraints: string[] };
export type Home = { lat: number; lon: number };
export type Recap = { userId: string; name: string; line: string; photoUrl?: string };
export type Vote = { userId: string; name: string; optionIds: number[] };
