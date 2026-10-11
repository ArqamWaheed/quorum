// Time math lives in the client (bot). The workflow only ever sees absolute ms timestamps.
const OFF = () => process.env.GROUP_UTC_OFFSET ?? '+05:00';

export const at = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00${OFF()}`);
export const dayBefore = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);

// Today's date in the group's local time zone (YYYY-MM-DD).
export function localToday(now = Date.now()) {
  const [, sign, h, m] = OFF().match(/^([+-])(\d\d):(\d\d)$/) ?? ['', '+', '00', '00'];
  const offMs = (sign === '-' ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60_000;
  return new Date(now + offMs).toISOString().slice(0, 10);
}

export function fmtLocal(ms: number) {
  const [, sign, h, m] = OFF().match(/^([+-])(\d\d):(\d\d)$/) ?? ['', '+', '00', '00'];
  const offMs = (sign === '-' ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60_000;
  return new Date(ms + offMs).toISOString().slice(0, 16).replace('T', ' ');
}

export interface Schedule { pollCloseAt: number; weatherCheckAt: number; reminderAt: number; outingEndAt: number }

export function realSchedule(date: string): Schedule {
  return {
    pollCloseAt: at(dayBefore(date), process.env.POLL_CLOSE ?? '22:00'),
    weatherCheckAt: at(date, '05:30'),
    reminderAt: at(date, '06:00'),
    outingEndAt: at(date, process.env.OUTING_END ?? '10:30'),
  };
}

// `/plan test`: the same workflow compressed into minutes. Drafting alone takes ~2 min on the
// Gemma free tier, so the poll stays open 7 min to leave ~5 min for voting.
export function testSchedule(now = Date.now()): Schedule {
  const min = 60_000;
  return { pollCloseAt: now + 7 * min, weatherCheckAt: now + 9 * min, reminderAt: now + 10 * min, outingEndAt: now + 12 * min };
}
