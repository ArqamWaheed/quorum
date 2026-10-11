// Server-rendered pages: native CSS, no framework, phone-first.
// System: Geist + Geist Mono (mono only for real times and logs), one accent (blaze yellow),
// radius 8px for every container and control; trail marks are 2px because they depict painted blazes.
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const css = `
:root{
  --bg:#f3f4ef;--surface:#fbfbf8;--ink:#17201b;--muted:#56625a;--line:#d4d9cf;
  --accent:#e8b400;--on-accent:#17201b;--fail:#b3402a;--r:8px;
  --sans:"Geist",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#121916;--surface:#18211d;--ink:#e6ebe5;--muted:#9aa89f;--line:#2c3a33;
  --accent:#f0c232;--on-accent:#121916;--fail:#ee8a73;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.55 var(--sans)}
a{color:inherit;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:3px}
a:hover{text-decoration-thickness:3px}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:2px}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header.top{display:flex;align-items:center;justify-content:space-between;height:64px}
header.top .mark{font-weight:700;letter-spacing:-.01em;text-decoration:none;display:flex;align-items:center;gap:10px}
header.top .mark i{display:block;width:10px;height:16px;border-radius:2px;background:var(--accent)}
header.top nav{display:flex;gap:20px;font-size:15px}
header.top nav a{text-decoration:none;color:var(--muted)}
header.top nav a:hover,header.top nav a[aria-current]{color:var(--ink)}
header.top nav a[aria-current]{text-decoration:underline}
.skip{position:absolute;left:-999px;top:8px;background:var(--accent);color:var(--on-accent);padding:8px 12px;border-radius:var(--r);z-index:10}
.skip:focus{left:8px}
h1,h2,h3{letter-spacing:-.025em;line-height:1.08;margin:0;text-wrap:balance}
p{text-wrap:pretty}
h1{font-size:clamp(34px,5.2vw,56px);font-weight:700}
h2{font-size:clamp(24px,3vw,32px);font-weight:700}
h3{font-size:18px;font-weight:600;letter-spacing:-.01em}
p{margin:0;max-width:68ch}
.muted{color:var(--muted)}
.mono{font-family:var(--mono);font-size:.88em}
.btn{transition:background-color .2s,border-color .2s,transform .2s;display:inline-flex;align-items:center;justify-content:center;height:46px;padding:0 20px;border-radius:var(--r);font:600 16px var(--sans);text-decoration:none;cursor:pointer;border:2px solid var(--ink);white-space:nowrap}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.btn.primary:hover{background:color-mix(in srgb,var(--accent) 85%,var(--ink))}
.textlink{font-weight:600;align-self:center}
.btn:active{transform:translateY(1px)}
.btn[disabled]{opacity:.6;cursor:wait}

/* landing */
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:48px 0 72px}
.hero .lede{margin-top:20px;font-size:19px;color:var(--muted);max-width:34ch}
.hero .ctas{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap}
.preview{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:28px 28px 8px}
.preview figcaption{font-size:14px;color:var(--muted);margin-top:4px;padding-bottom:20px}
.breaks{padding:64px 0;border-top:1px solid var(--line)}
.breaks ol{list-style:none;margin:32px 0 0;padding:0;display:grid;grid-template-columns:repeat(12,1fr);gap:40px 32px}
.breaks li:nth-child(1){grid-column:1 / span 7}
.breaks li:nth-child(2){grid-column:8 / span 5}
.breaks li:nth-child(3){grid-column:1 / span 12;max-width:62ch}
.breaks li p{margin-top:8px;color:var(--muted)}
.breaks li .proof{margin-top:12px}
.runs{display:flex;gap:6px;margin-top:12px}
.runs span{font-family:var(--mono);font-size:13px;height:28px;min-width:44px;padding:0 8px;border-radius:var(--r);display:inline-flex;align-items:center;justify-content:center;border:2px solid var(--fail);color:var(--fail)}
.runs span.ok{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
.links{padding:56px 0 24px;border-top:1px solid var(--line);display:flex;gap:32px;flex-wrap:wrap}
.links a{font-weight:600}
.nap{font-size:15px;color:var(--muted);max-width:62ch;padding:0 0 40px}

/* trail (plan timeline, shared by landing preview and plan page) */
.trail{list-style:none;margin:0;padding:0;position:relative}
.trail::before{content:"";position:absolute;left:8px;top:6px;bottom:22px;width:2px;background:var(--line)}
.trail>li{position:relative;padding:0 0 20px 36px}
.trail .bz{position:absolute;left:0;top:3px;width:18px;height:24px;border-radius:2px;border:2px solid var(--line);background:var(--bg)}
.trail .done .bz{background:var(--accent);border-color:var(--accent)}
.trail .now .bz{background:var(--accent);border-color:var(--ink)}
.trail .skip .bz{border-style:dashed}
.trail .fail .bz{background:var(--fail);border-color:var(--fail)}
.trail strong{font-weight:600}
.trail .when{font-family:var(--mono);font-size:13px;color:var(--muted);margin-left:8px}
.trail .note{font-size:15px;color:var(--muted);margin-top:2px}
.attempts{list-style:none;margin:6px 0 0;padding:0;line-height:1.6;font-family:var(--mono);font-size:13px;color:var(--muted)}
.attempts .bad{color:var(--fail)}

/* plan page */
.plan{max-width:680px;padding:32px 0 64px}
.plan .meta{color:var(--muted)}
.plan h1{margin-top:8px}
.clock{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:24px}
.clock b{font-variant-numeric:tabular-nums;font-family:var(--mono);font-weight:500;font-size:clamp(44px,11vw,64px);line-height:1;letter-spacing:-.04em}
.plan h2{margin:48px 0 20px}
.options{border-top:1px solid var(--line)}
.option{padding:18px 0;border-bottom:1px solid var(--line)}
.option .row{display:flex;justify-content:space-between;gap:16px;align-items:baseline}
.option .votes{font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:14px;color:var(--muted);white-space:nowrap}
.option .chosen{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;margin-left:8px}
.option .chosen i{display:block;width:8px;height:12px;border-radius:2px;background:var(--accent)}
.option p{font-size:15px;color:var(--muted);margin-top:4px}
.option ul{margin:8px 0 0;padding-left:18px;font-size:15px}
.foot{margin-top:40px;font-size:14px;color:var(--muted)}

/* try */
.try{display:grid;grid-template-columns:1fr 1fr;gap:56px;padding:32px 0 64px;align-items:start}
.try .lede{margin-top:14px;color:var(--muted);max-width:42ch}
form{margin-top:28px;display:grid;gap:20px}
.field{display:grid;gap:8px}
label{font-weight:600;font-size:15px}
.help{font-size:14px;color:var(--muted)}
input,textarea{width:100%;font:inherit;color:var(--ink);background:var(--surface);border:2px solid var(--line);border-radius:var(--r);padding:10px 12px}
input:focus,textarea:focus{border-color:var(--ink);outline:none}
textarea{min-height:150px;resize:vertical}
.result{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:24px;min-height:320px}
.result .empty{color:var(--muted)}
.skel{height:14px;border-radius:var(--r);background:var(--line);margin:10px 0}
.skel.w1{width:70%}.skel.w2{width:90%}.skel.w3{width:45%}
.skel-group{padding:16px 0;border-bottom:1px solid var(--line)}
.error{color:var(--fail);font-weight:600}
.stats{margin-top:16px;font-size:14px;color:var(--muted)}

footer{border-top:1px solid var(--line);padding:24px 0 40px;font-size:14px;color:var(--muted)}

@media (max-width:860px){
  .hero,.try{grid-template-columns:1fr;gap:36px}
  .hero{padding:24px 0 48px}
  .breaks li:nth-child(n){grid-column:1 / -1}
  header.top nav a.hide-sm{display:none}
}
@media (prefers-reduced-motion:no-preference){
  .rise{animation:rise .6s cubic-bezier(.16,1,.3,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
}
`;

const REPO = 'https://github.com/ArqamWaheed/quorum';

export function layout(title: string, body: string, description = 'Quorum plans one small outing for a friend group and keeps time until it happens.', current?: 'try') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='4' y='1' width='8' height='14' rx='1.5' fill='%23e8b400'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
<header class="top"><a class="mark" href="/"><i aria-hidden="true"></i>Quorum</a>
<nav><a href="/try"${current === 'try' ? ' aria-current="page"' : ''}>Try it</a><a class="hide-sm" href="${REPO}">Code</a></nav></header>
<main id="main">${body}</main>
<footer>Open source under Apache-2.0. <a href="${REPO}">github.com/ArqamWaheed/quorum</a>. <a href="${REPO}#privacy">Privacy</a></footer>
</div></body></html>`;
}

type Step = { cls: string; title: string; when?: string; detail?: string };
const trail = (steps: Step[]) =>
  `<ol class="trail">${steps.map((s) =>
    `<li class="${s.cls}"><span class="bz" aria-hidden="true"></span><strong>${esc(s.title)}</strong>${s.when ? `<span class="when">${esc(s.when)}</span>` : ''}${s.detail ?? ''}</li>`,
  ).join('')}</ol>`;

export function landingPage(videoUrl?: string, planId?: string) {
  // Real data from the 11 Oct rehearsal (compressed timers), rendered with the same trail component as /p/:id.
  const rehearsal = trail([
    { cls: 'done', title: 'Options drafted', when: '15:28', detail: '<p class="note">3 real places near Islamabad, in 72 s</p>' },
    { cls: 'done', title: 'Plan locked', when: '15:29', detail: '<p class="note">Kachnar Park, 08:00. Shaped by "no car" and "home by 11"</p>' },
    { cls: 'done', title: 'Weather re-check', when: '15:36', detail: '<p class="note">Up to 12% rain. Plan stands</p>' },
    { cls: 'done', title: 'Reminder sent', when: '15:37' },
    { cls: 'done', title: 'Recap remembered', when: '15:40' },
  ]);
  return layout('Quorum', `
<section class="hero">
  <div>
    <h1>Group plans die when nobody holds the clock.</h1>
    <p class="lede">Quorum is a Discord member that drafts the outing, runs the poll, checks the rain and sends the reminder.</p>
    <div class="ctas"><a class="btn primary" href="/try">Try it</a><a class="textlink" href="${REPO}">Read the code</a></div>
  </div>
  <figure class="preview rise" style="margin:0">
    ${rehearsal}
    <figcaption>A real run on 11 October, with the timers compressed to minutes.</figcaption>
  </figure>
</section>

<section class="breaks">
  <h2>Then I tried to break it.</h2>
  <ol>
    <li><h3>Killed the worker mid-poll</h3><p>Ran <span class="mono">kill -9</span> on the Temporal worker and restarted the server. The plan came back in the voting step, and the next vote still locked it.</p></li>
    <li><h3>Put the agent server to sleep</h3><p>The weather check failed four times, then went through as soon as the server came back.</p>
      <div class="runs" aria-label="Attempts 1 to 4 failed, attempt 5 succeeded"><span>1</span><span>2</span><span>3</span><span>4</span><span class="ok">5</span></div></li>
    <li><h3>Made it rain</h3><p>With the rain limit forced to zero, the 06:00 reminder switched the group to the backup plan on its own.</p></li>
  </ol>
</section>

<section class="links">
  <a href="/try">Draft a plan for your own group</a>
  ${planId ? `<a href="/p/${esc(planId)}">See the plan page from the run</a>` : ''}
  ${videoUrl ? `<a href="${esc(videoUrl)}">Watch the 60-second video</a>` : ''}
</section>
<p class="nap">This page runs on Render's free tier, which sleeps after 15 idle minutes. If it took a minute to load, that was the same nap Quorum's workflow retries through.</p>`);
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
    return `<ul class="attempts">${xs.map((e) => `<li class="${/failed/.test(e.detail) ? 'bad' : ''}">${esc(stamp(e.at))} ${esc(e.detail)}</li>`).join('')}</ul>`;
  };
  const s = p.schedule;
  const cls = (s0: string, next?: string) =>
    status === 'no-quorum' && ['locked', 'fallback', 'reminder', 'recap-ask', 'done'].includes(s0) ? 'skip'
      : next && reached(next) ? 'done' : reached(s0) ? (status === 'done' ? 'done' : 'now') : '';
  const wx = p.weather;
  const steps: Step[] = [
    { cls: cls('drafting', 'voting'), title: 'Options drafted', detail: attempts('draftPlans') },
    { cls: cls('voting', 'locked'), title: 'Poll open', when: s ? `closes ${fmt(s.pollCloseAt)}` : '' },
    status === 'no-quorum'
      ? { cls: 'fail', title: 'Not enough yeses', detail: `<p class="note">Needed ${esc(p.quorum)}. The poll closed without them.</p>` }
      : { cls: cls('locked', 'reminder'), title: 'Plan locked', when: p.counts ? `votes ${p.counts.join(' / ')}` : '' },
    { cls: wx ? (wx.go === false ? 'fail' : 'done') : cls('reminder'), title: 'Weather re-check', when: s ? fmt(s.weatherCheckAt) : '',
      detail: (wx ? `<p class="note">${wx.go === false ? `Rain up to ${esc(wx.maxRain)}%. Switched to the backup plan.` : `Up to ${esc(wx.maxRain)}% rain. Plan stands.`}</p>` : '') + attempts('recheckWeather') },
    { cls: cls('reminder', 'recap-ask'), title: 'Morning reminder', when: s ? fmt(s.reminderAt) : '' },
    { cls: cls('recap-ask', 'done'), title: 'Recap asked', when: s ? fmt(s.outingEndAt) : '' },
    { cls: cls('done'), title: 'Remembered for next time', when: p.recapCount ? `${p.recapCount} recap${p.recapCount === 1 ? '' : 's'}` : '', detail: attempts('storeRecap') },
  ];

  const next = s && ([
    ['Poll closes', s.pollCloseAt], ['Weather check', s.weatherCheckAt], ['Reminder', s.reminderAt], ['Recap', s.outingEndAt],
  ] as const).find(([, t]) => t > Date.now());

  const chosenWhere = p.chosen?.where;
  const shaped = (o: any) => {
    const xs: string[] = o.shapedBy ?? [];
    if (!xs.length) return '';
    if (!publicNames) return `<p>Shaped by ${xs.length} of the group's limits.</p>`;
    return `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  };
  const opts = (p.options ?? []).map((o, i) => `
<div class="option">
  <div class="row"><h3>${esc(o.title)}${o.where === chosenWhere ? '<span class="chosen"><i aria-hidden="true"></i>Chosen</span>' : ''}</h3>
  ${p.counts ? `<span class="votes">${p.counts[i] ?? 0} vote${(p.counts[i] ?? 0) === 1 ? '' : 's'}</span>` : ''}</div>
  <p>${esc(o.where)}, from ${esc(o.start)} for ${esc(o.durationH)} h. ${esc(o.weatherNote)}</p>${shaped(o)}
</div>`).join('');

  const title = p.chosen?.title ?? (p.date ? `Outing on ${p.date}` : 'Outing');
  return layout(`Quorum plan ${p.date ?? ''}`.trim(), `
<article class="plan">
  <p class="meta">${esc(p.date ?? '')}${p.quorum ? `, needs ${esc(p.quorum)} ${p.quorum === 1 ? 'person' : 'people'}` : ''}</p>
  <h1>${esc(title)}</h1>
  ${next ? `<div class="clock"><b>${esc(fmt(next[1]).slice(11))}</b><span class="muted">${esc(next[0])}, ${esc(fmt(next[1]).slice(0, 10))}</span></div>` : ''}
  <h2>Where it stands</h2>
  ${trail(steps)}
  ${opts ? `<h2>The options</h2><div class="options">${opts}</div>` : ''}
  <p class="foot">Times are the group's local time${p.tz ? ` (UTC${esc(p.tz)})` : ''}. Every call to the agent server is logged with its attempt number, so a cold start shows up as failed attempts followed by a success.</p>
</article>`);
}

export function notFoundPage() {
  return layout('Plan not found', `<article class="plan"><h1>No plan with that link.</h1><p class="muted" style="margin-top:16px">Check the link in the Discord message, or <a href="/try">draft a plan for your own group</a>.</p></article>`);
}

export function tryPage() {
  const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const today = day(0), tomorrow = day(1), maxDate = day(14);
  return layout('Try Quorum', `
<section class="try">
  <div>
    <h1>Draft an outing for your group.</h1>
    <p class="lede">Add a few people and what limits them. Quorum checks the forecast and real places from OpenStreetMap, then suggests short outings that work for everyone.</p>
    <form id="f">
      <div class="field"><label for="people">People</label>
        <textarea id="people" name="people" required aria-describedby="people-help">Sara: knee hates long descents
Omar: no car; home by 11
Lina: broke this month
Tom: wants a view</textarea>
        <span class="help" id="people-help">One per line, written as Name: limit; limit. Use made-up names.</span></div>
      <div class="field"><label for="place">Starting point</label>
        <input id="place" name="place" required value="Islamabad" aria-describedby="place-help">
        <span class="help" id="place-help">A city, or coordinates like 33.68, 73.05.</span></div>
      <div class="field"><label for="date">Date</label>
        <input id="date" name="date" type="date" required value="${tomorrow}" min="${today}" max="${maxDate}" aria-describedby="date-help">
        <span class="help" id="date-help">Within the next 14 days, as far as the forecast goes.</span></div>
      <div><button class="btn primary" id="go" type="submit">Draft options</button></div>
    </form>
  </div>
  <div class="result" id="out" aria-live="polite">
    <p class="empty">Your options appear here, each with the limits that shaped it. Nothing you type is stored. Five drafts per hour per visitor.</p>
  </div>
</section>
<script>
const f=document.getElementById('f'),out=document.getElementById('out'),go=document.getElementById('go');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const skel='<div class="skel-group"><div class="skel w1"></div><div class="skel w2"></div><div class="skel w3"></div></div>';
f.addEventListener('submit',async e=>{e.preventDefault();go.disabled=true;go.textContent='Drafting';
out.innerHTML='<p class="muted">Checking the forecast and nearby places, then asking Gemma 4. This usually takes one to two minutes.</p>'+skel+skel+skel;
try{const r=await fetch('/try',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
const j=await r.json();if(!r.ok)throw new Error(j.error||('Error '+r.status));
out.innerHTML='<h2>Options near '+esc(j.placeName)+'</h2><div class="options" style="margin-top:16px">'+j.options.map(o=>'<div class="option"><h3>'+esc(o.title)+'</h3><p>'+esc(o.where)+', from '+esc(o.start)+' for '+esc(o.durationH)+' h. '+esc(o.weatherNote)+'</p><ul>'+(o.shapedBy||[]).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>').join('')+'</div>'
+'<p class="stats">'+j.toolCalls+' tool calls in '+(j.ms/1000).toFixed(0)+' s'+(j.invented?'. Dropped '+j.invented+' invented place'+(j.invented>1?'s':''):'')+(j.fallback?'. Some options were built by code because the model answer was unusable':'')+'.</p>';
}catch(err){out.innerHTML='<p class="error">'+esc(err.message)+'</p>'}
go.disabled=false;go.textContent='Draft options';});
</script>`, undefined, 'try');
}
