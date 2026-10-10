// Fetch and cache (Atlas places_cache) the real spots around HOME_LAT/HOME_LON, and show today's forecast.
// Run once after setting .env, and again if Overpass was down: drafts then never wait on Overpass.
import { places } from '../src/mastra/tools/places';
import { forecast } from '../src/mastra/tools/weather';
import { localToday } from '../src/shared/time';

const lat = Number(process.env.HOME_LAT), lon = Number(process.env.HOME_LON);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Set HOME_LAT and HOME_LON in .env');
const spots = await places(lat, lon);
console.log(`${spots.length} named spots within 25 km:`);
console.table(spots.slice(0, 25).map((s) => ({ name: s.name, kind: s.kind })));
console.table(await forecast(lat, lon, localToday()));
process.exit(0);
