# Gemma smoke test (Gate 1), 2026-10-10

Fake 5-person roster, 8 drafts per model (Lahore ×5, Islamabad ×3), Gemini API free tier, both models run concurrently on one key. `npm run smoke -- --n 8`.

| Model | Mode | Valid + tool calls | Invented places | Median latency | Gemini 5xx/429 retries |
|---|---|---|---|---|---|
| gemma-4-26b-a4b-it | native | 8/8 | 0 | 127.7 s | 0 |
| gemma-4-31b-it | native | 7/8 | 0 | 202.1 s | 4 |

Raw rows:

```
{"i":0,"city":"Lahore","date":"2026-10-11","tools":2,"valid":true,"invented":0,"ms":110577,"apiRetries":0}
{"i":1,"city":"Lahore","date":"2026-10-12","tools":2,"valid":true,"invented":0,"ms":118049,"apiRetries":0}
{"i":2,"city":"Lahore","date":"2026-10-13","tools":2,"valid":true,"invented":0,"ms":128037,"apiRetries":0}
{"i":3,"city":"Lahore","date":"2026-10-14","tools":2,"valid":true,"invented":0,"ms":475058,"apiRetries":0}
{"i":4,"city":"Lahore","date":"2026-10-15","tools":2,"valid":true,"invented":0,"ms":127741,"apiRetries":0}
{"i":5,"city":"Islamabad","date":"2026-10-11","tools":2,"valid":true,"invented":0,"ms":128640,"apiRetries":0}
{"i":6,"city":"Islamabad","date":"2026-10-12","tools":2,"valid":true,"invented":0,"ms":112111,"apiRetries":0}
{"i":7,"city":"Islamabad","date":"2026-10-13","tools":2,"valid":true,"invented":0,"ms":124709,"apiRetries":0}
google/gemma-4-26b-a4b-it · native: validity 8/8 · invented places 0 · median 127.7 s · Gemini 5xx/429 retries 0
{"i":0,"city":"Lahore","date":"2026-10-11","tools":2,"valid":true,"invented":0,"ms":188117,"apiRetries":1}
{"i":1,"city":"Lahore","date":"2026-10-12","tools":2,"valid":true,"invented":0,"ms":202136,"apiRetries":0}
{"i":2,"city":"Lahore","date":"2026-10-13","tools":2,"valid":true,"invented":0,"ms":139287,"apiRetries":0}
{"i":3,"city":"Lahore","date":"2026-10-14","tools":2,"valid":true,"invented":0,"ms":211720,"apiRetries":0}
{"i":4,"city":"Lahore","date":"2026-10-15","tools":2,"valid":true,"invented":0,"ms":228001,"apiRetries":0}
{"i":5,"city":"Islamabad","date":"2026-10-11","tools":2,"valid":true,"invented":0,"ms":222853,"apiRetries":0}
{"i":6,"city":"Islamabad","date":"2026-10-12","tools":0,"valid":false,"invented":null,"ms":97255,"apiRetries":1,"err":"This model is currently experiencing high demand. Spikes in demand are usually t"}
{"i":7,"city":"Islamabad","date":"2026-10-13","tools":2,"valid":true,"invented":0,"ms":152103,"apiRetries":2}
google/gemma-4-31b-it · native: validity 7/8 · invented places 0 · median 202.1 s · Gemini 5xx/429 retries 4
```
