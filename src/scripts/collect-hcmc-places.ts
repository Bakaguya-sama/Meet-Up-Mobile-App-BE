import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUTPUT_PATH = resolve(
  process.argv[2] ?? 'outputs/place-data/hcmc-osm-places.json',
);
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const BBOX = '10.65,106.50,10.95,106.95'; // South, West, North, East: central Ho Chi Minh City.
const LIMIT = Number(process.env.PLACE_COLLECTION_LIMIT ?? 1000);
const TIMEOUT_MS = 180_000;

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const query = `
[out:json][timeout:120];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream|cinema|theatre|arts_centre|nightclub|library|community_centre|events_venue|bowling_alley|marketplace)$"](${BBOX});
  nwr["tourism"~"^(attraction|museum|gallery|theme_park|viewpoint|zoo|aquarium|hotel|artwork)$"](${BBOX});
  nwr["leisure"~"^(park|garden|fitness_centre|sports_centre|water_park|playground|bowling_alley)$"](${BBOX});
  nwr["shop"~"^(mall|department_store|books|clothes|toys|gift|supermarket)$"](${BBOX});
  nwr["historic"~"^(monument|memorial|museum|castle|archaeological_site)$"](${BBOX});
);
out center tags;
`;

async function main() {
  if (!Number.isInteger(LIMIT) || LIMIT < 1 || LIMIT > 10_000) {
    throw new Error(
      'PLACE_COLLECTION_LIMIT must be an integer from 1 to 10000',
    );
  }
  const elements = await fetchElements();
  const records = elements
    .map(toPlace)
    .filter(
      (place): place is NonNullable<ReturnType<typeof toPlace>> =>
        place !== null,
    );
  const deduplicated = [
    ...new Map(records.map((place) => [place.providerPlaceId, place])).values(),
  ];
  const selected = diversifyAndLimit(deduplicated, LIMIT);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        source: 'OpenStreetMap contributors',
        attribution:
          '© OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
        license: 'Open Database License (ODbL) 1.0',
        generatedAt: new Date().toISOString(),
        area: 'Central Ho Chi Minh City, Vietnam',
        count: selected.length,
        places: selected,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.stdout.write(`Saved ${selected.length} places to ${OUTPUT_PATH}\n`);
}

async function fetchElements(): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt += 1)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent':
              'MeetUpHoChiMinhPlaceCollector/1.0 (local research tool)',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok)
          throw new Error(
            `Overpass ${endpoint} returned HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`,
          );
        const payload = (await response.json()) as { elements?: OsmElement[] };
        if (!Array.isArray(payload.elements))
          throw new Error('Overpass response is missing elements');
        return payload.elements;
      } catch (error) {
        lastError = error;
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 1500 * (attempt + 1)),
        );
      }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('All Overpass endpoints failed');
}

function toPlace(element: OsmElement) {
  const tags = element.tags;
  const point =
    element.type === 'node'
      ? { latitude: element.lat, longitude: element.lon }
      : element.center
        ? { latitude: element.center.lat, longitude: element.center.lon }
        : null;
  const name = tags?.name ?? tags?.['name:vi'] ?? tags?.brand;
  if (
    !tags ||
    !point ||
    !name ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude)
  )
    return null;
  const types = Object.entries(tags)
    .filter(([key]) =>
      ['amenity', 'tourism', 'leisure', 'shop', 'historic', 'cuisine'].includes(
        key,
      ),
    )
    .map(([key, value]) => `${key}:${value}`);
  return {
    provider: 'openstreetmap',
    providerPlaceId: `${element.type}/${element.id}`,
    name,
    primaryType: primaryType(tags),
    types,
    priceLevel: parsePriceLevel(tags.price_level),
    priceRange: tags.price_range ?? null,
    location: point,
    address: {
      street: tags['addr:street'] ?? null,
      housenumber: tags['addr:housenumber'] ?? null,
      district: tags['addr:district'] ?? tags['addr:subdistrict'] ?? null,
      city: tags['addr:city'] ?? 'Thành phố Hồ Chí Minh',
      postcode: tags['addr:postcode'] ?? null,
    },
    website: tags.website ?? tags['contact:website'] ?? null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    openingHours: tags.opening_hours ?? null,
    cuisine: tags.cuisine ?? null,
    wheelchair: tags.wheelchair ?? null,
    brand: tags.brand ?? null,
    operator: tags.operator ?? null,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    tags,
  };
}

function primaryType(tags: Record<string, string>): string {
  for (const key of ['amenity', 'tourism', 'leisure', 'shop', 'historic']) {
    if (tags[key]) return `${key}:${tags[key]}`;
  }
  return 'place:point_of_interest';
}

function parsePriceLevel(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 4 ? parsed : null;
}

function diversifyAndLimit<T extends { primaryType: string }>(
  places: T[],
  limit: number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const place of places)
    groups.set(place.primaryType, [
      ...(groups.get(place.primaryType) ?? []),
      place,
    ]);
  const keys = [...groups.keys()].sort();
  const selected: T[] = [];
  while (selected.length < limit && keys.length) {
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const item = groups.get(keys[index])?.shift();
      if (item) selected.push(item);
      else keys.splice(index, 1);
      if (selected.length === limit) break;
    }
  }
  return selected;
}

void main();
