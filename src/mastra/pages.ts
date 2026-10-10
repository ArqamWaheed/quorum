// Server-rendered pages: one column, phone-first, no framework. Trail-blaze timeline is the one bold element.
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const css = `
:root{--fog:#EDF0EA;--ink:#1C2A23;--blaze:#E5B200;--slate:#4D6B88;--moss:#66766D;--rain:#B5462F;--card:#F7F8F4;--line:#C9D1C7}
@media (prefers-color-scheme:dark){:root{--fog:#141C18;--ink:#E4EAE3;--blaze:#F0C232;--slate:#8FB0CF;--moss:#93A39A;--rain:#E07A62;--card:#1B2520;--line:#33433A}}
*{box-sizing:border-box}
body{margin:0;background:var(--fog);color:var(--ink);font:400 1.0625rem/1.55 Overpass,system-ui,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:38rem;margin:0 auto;padding:2.5rem 1rem 4rem}
a{color:inherit;text-decoration-color:var(--blaze);text-decoration-thickness:.15em;text-underline-offset:.2em}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--slate);outline-offset:2px}
h1{font-weight:900;font-size:clamp(2rem,8vw,3.1rem);line-height:1.02;letter-spacing:-.02em;margin:.2rem 0 1rem}
h2{font-weight:700;font-size:1.25rem;margin:2.5rem 0 .75rem}
p{margin:.5rem 0}
.quiet{color:var(--moss)}
.small{font-size:.9rem}
.clock{display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap;margin:1.25rem 0 0}
.clock b{font-weight:900;font-size:clamp(2.6rem,12vw,4rem);line-height:1;font-variant-numeric:tabular-nums}
.trail{list-style:none;margin:1rem 0 0;padding:0;position:relative}
.trail::before{content:"";position:absolute;left:.55rem;top:.4rem;bottom:.4rem;width:2px;background:var(--line)}
.trail li{position:relative;padding:0 0 1.4rem 2.4rem}
.blaze{position:absolute;left:0;top:.2rem;width:1.15rem;height:1.6rem;border-radius:2px;border:2px solid var(--line);background:var(--fog)}
.done .blaze{background:var(--blaze);border-color:var(--blaze)}
.now .blaze{background:var(--blaze);border-color:var(--ink);animation:mark 1.6s ease-out 1}
.skip .blaze{border-style:dashed}
.fail .blaze{background:var(--rain);border-color:var(--rain)}
@keyframes mark{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.now .blaze{animation:none}}
.trail strong{font-weight:700}
.when{color:var(--moss);font-size:.9rem;font-variant-numeric:tabular-nums}
.attempts{margin:.35rem 0 0;padding:0;list-style:none;font-size:.85rem;color:var(--slate)}
.attempts li{padding:0}
.attempts .bad{color:var(--rain)}
.opt{background:var(--card);border-left:6px solid var(--line);padding:.9rem 1rem;margin:.75rem 0;border-radius:0 6px 6px 0}
.opt.chosen{border-left-color:var(--blaze)}
.opt h3{margin:0 0 .25rem;font-size:1.1rem;font-weight:700}
.opt ul{margin:.4rem 0 0;padding-left:1.1rem;font-size:.92rem}
label{display:block;font-weight:700;margin:1.2rem 0 .3rem}
input,textarea{width:100%;font:inherit;color:inherit;background:var(--card);border:2px solid var(--line);border-radius:6px;padding:.6rem .7rem}
textarea{min-height:8.5rem;resize:vertical}
.hint{font-weight:400;color:var(--moss);font-size:.88rem}
button{margin-top:1.4rem;font:inherit;font-weight:900;background:var(--ink);color:var(--fog);border:0;border-radius:6px;padding:.8rem 1.4rem;cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}
.note{border-left:4px solid var(--slate);padding:.2rem 0 .2rem .8rem;margin:1.2rem 0}
.err{border-left-color:var(--rain)}
footer{margin-top:3rem;font-size:.88rem;color:var(--moss)}
`;

export function layout(title: string, body: string, description = 'Quorum plans one small outing for a friend group and keeps time until it happens.') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;700;900&display=swap" rel="stylesheet">
<style>${css}</style></head><body><main>${body}
<footer><a href="/">Quorum</a> is open source (Apache-2.0): <a href="https://github.com/ArqamWaheed/quorum">github.com/ArqamWaheed/quorum</a></footer>
</main></body></html>`;
}

export function landingPage(videoUrl?: string, planId?: string) {
  return layout('Quorum', `
<h1>Your group says “we should”. Quorum makes sure you go.</h1>
<p>Quorum is a member of a friend group’s Discord server. It drafts two or three small outings that respect everyone’s limits, runs the poll, waits for enough people to say yes, checks the weather at 05:30 and posts the reminder at 06:00.</p>
<p class="quiet">The waiting is done by a Temporal workflow, so a crashed laptop or a sleeping server only delays a step. Plans are drafted by Gemma 4 through a Mastra agent. The group’s limits and past outings live in MongoDB Atlas.</p>
<h2>See it</h2>
<ul>
${planId ? `<li><a href="/p/${esc(planId)}">The real plan from our weekend</a>, with every retry logged</li>` : ''}
<li><a href="/try">Draft a plan for your own group</a> with made-up names</li>
${videoUrl ? `<li><a href="${esc(videoUrl)}">Watch the 90-second video</a></li>` : ''}
</ul>
<p class="note small">This page runs on Render’s free tier, which sleeps after 15 idle minutes. If it took about a minute to load, that was the same nap Quorum’s workflow retries through at 05:30.</p>`);
}

export interface PlanView {
  _id: string; date?: string; status?: string; quorum?: number;
  options?: any[]; counts?: number[]; chosen?: any; weather?: { maxRain?: number; go?: boolean };
  schedule?: { pollCloseAt: number; weatherCheckAt: number; reminderAt: number; outingEndAt: number };
  events?: { at: Date | string; type: string; detail: string }[]; recapCount?: number; tz?: string;
}

const ORDER = ['drafting', 'voting', 'locked', 'fallback', 'reminder', 'recap-ask', 'done'];

export function planPage(p: PlanView, fmt: (ms: number) => string, publicNames: boolean) {
  const status = p.status ?? 'drafting';
  const reached = (s: string) => ORDER.indexOf(status) >= ORDER.indexOf(s);
  const ev = p.events ?? [];
  const stamp = (at: Date | string) => { const d = new Date(at); return `${fmt(d.getTime()).slice(11)}:${String(d.getUTCSeconds()).padStart(2, '0')}`; };
  const attempts = (type: string) => {
    const xs = ev.filter((e) => e.type === type);
    if (!xs.length) return '';
    return `<ul class="attempts">${xs.map((e) => `<li class="${/failed/.test(e.detail) ? 'bad' : ''}">${esc(stamp(e.at))}: ${esc(e.detail)}</li>`).join('')}</ul>`;
  };
  const s = p.schedule;
  const step = (cls: string, title: string, when: string, detail = '') =>
    `<li class="${cls}"><span class="blaze" aria-hidden="true"></span><strong>${title}</strong>${when ? ` <span class="when">${esc(when)}</span>` : ''}${detail}</li>`;
  const cls = (s0: string, next?: string) =>
    status === 'no-quorum' && ['locked', 'fallback', 'reminder', 'recap-ask', 'done'].includes(s0) ? 'skip'
      : next && reached(next) ? 'done' : reached(s0) ? (status === 'done' ? 'done' : 'now') : '';
  const wx = p.weather;
  const steps = [
    step(cls('drafting', 'voting'), 'Options drafted', '', attempts('draftPlans')),
    step(cls('voting', 'locked'), 'Poll open', s ? `closes ${fmt(s.pollCloseAt)}` : ''),
    status === 'no-quorum'
      ? step('fail', 'Not enough yeses', '', `<p class="small">Quorum needed ${esc(p.quorum)}; the poll closed without it.</p>`)
      : step(cls('locked', 'reminder'), 'Plan locked', p.counts ? `votes ${p.counts.join(' / ')}` : ''),
    step(wx ? (wx.go === false ? 'fail' : 'done') : cls('reminder'), 'Weather re-check', s ? fmt(s.weatherCheckAt) : '',
      (wx ? `<p class="small">${wx.go === false ? `Rain ${esc(wx.maxRain)}%: switched to the rain plan.` : `Max rain ${esc(wx.maxRain)}%: good to go.`}</p>` : '') + attempts('recheckWeather')),
    step(cls('reminder', 'recap-ask'), 'Morning reminder', s ? fmt(s.reminderAt) : ''),
    step(cls('recap-ask', 'done'), 'Recap asked', s ? fmt(s.outingEndAt) : ''),
    step(cls('done'), 'Remembered for next time', p.recapCount ? `${p.recapCount} recaps` : '', attempts('storeRecap')),
  ].join('');

  const next = s && [
    ['Poll closes', s.pollCloseAt], ['Weather check', s.weatherCheckAt], ['Reminder', s.reminderAt], ['Recap', s.outingEndAt],
  ].find(([, t]) => (t as number) > Date.now());

  const chosenWhere = p.chosen?.where;
  const shaped = (o: any) => {
    const xs: string[] = o.shapedBy ?? [];
    if (!xs.length) return '';
    if (!publicNames) return `<p class="small quiet">Shaped by ${xs.length} of the group’s limits.</p>`;
    return `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  };
  const opts = (p.options ?? []).map((o, i) => `
<div class="opt${o.where === chosenWhere ? ' chosen' : ''}">
<h3>${esc(o.title)}</h3>
<p class="small">${esc(o.where)}, from ${esc(o.start)} for ${esc(o.durationH)} h${p.counts ? `, ${p.counts[i] ?? 0} vote${(p.counts[i] ?? 0) === 1 ? '' : 's'}` : ''}</p>
<p class="small quiet">${esc(o.weatherNote)}</p>${shaped(o)}</div>`).join('');

  const title = p.chosen?.title ?? (p.date ? `Outing on ${p.date}` : 'Outing');
  return layout(`Quorum plan ${p.date ?? ''}`.trim(), `
<p class="quiet">${esc(p.date ?? '')}${p.quorum ? `, needs ${esc(p.quorum)} people` : ''}</p>
<h1>${esc(title)}</h1>
${next ? `<div class="clock"><b>${esc(fmt(next[1] as number).slice(11))}</b><span>${esc(next[0])}, ${esc(fmt(next[1] as number).slice(0, 10))}</span></div>` : ''}
<h2>Where it stands</h2>
<ol class="trail">${steps}</ol>
${opts ? `<h2>The options</h2>${opts}` : ''}
<p class="small quiet">Times are the group’s local time${p.tz ? ` (UTC${esc(p.tz)})` : ''}. Every call to the agent server is logged with its attempt number, so a cold start shows up as a failed attempt followed by a retry.</p>`);
}

export function notFoundPage() {
  return layout('Plan not found', `<h1>No plan with that link.</h1><p>Check the link in the Discord message, or <a href="/try">draft a plan for your own group</a>.</p>`);
}

export function tryPage() {
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  return layout('Try Quorum', `
<h1>Draft an outing for your group</h1>
<p>Write a few people and what limits them. Quorum checks the forecast and real places from OpenStreetMap, then suggests two or three short outings that work for everyone.</p>
<p class="small quiet">Use made-up names. Nothing you type here is stored with the group’s memory. Five drafts per hour per visitor.</p>
<form id="f">
<label for="people">People <span class="hint">one per line, “Name: limit; limit”</span></label>
<textarea id="people" name="people" required>Sara: knee hates long descents
Omar: no car; home by 11
Lina: broke this month
Tom: wants a view</textarea>
<label for="place">Where you start <span class="hint">a city, or “lat, lon”</span></label>
<input id="place" name="place" required value="Lahore">
<label for="date">Date <span class="hint">within the next 14 days</span></label>
<input id="date" name="date" type="date" required value="${tomorrow}">
<button id="go" type="submit">Draft options</button>
</form>
<div id="out" aria-live="polite"></div>
<script>
const f=document.getElementById('f'),out=document.getElementById('out'),go=document.getElementById('go');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
f.addEventListener('submit',async e=>{e.preventDefault();go.disabled=true;go.textContent='Drafting…';
out.innerHTML='<p class="note small">Checking the forecast and nearby places, then asking Gemma. This takes 10–60 seconds.</p>';
try{const r=await fetch('/try',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
const j=await r.json();if(!r.ok)throw new Error(j.error||('Error '+r.status));
out.innerHTML='<h2>Options near '+esc(j.placeName)+'</h2>'+j.options.map(o=>'<div class="opt"><h3>'+esc(o.title)+'</h3><p class="small">'+esc(o.where)+', from '+esc(o.start)+' for '+esc(o.durationH)+' h</p><p class="small quiet">'+esc(o.weatherNote)+'</p><ul>'+(o.shapedBy||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>').join('')
+'<p class="small quiet">'+j.toolCalls+' tool calls, '+(j.ms/1000).toFixed(1)+' s'+(j.invented?', '+j.invented+' invented place dropped':'')+(j.fallback?', some options built by code because the model’s answer was unusable':'')+'.</p>';
}catch(err){out.innerHTML='<p class="note err">'+esc(err.message)+'</p>'}
go.disabled=false;go.textContent='Draft options';});
</script>`);
}
