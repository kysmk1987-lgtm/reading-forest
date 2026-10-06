import { json, preflight } from './_lib/http';

/**
 * GET /api/geo → `{ country, region }` from Vercel's IP geolocation headers (no location permission, no storage).
 * `region` is the ISO 3166-2 subdivision suffix, e.g. `11` (서울) or `26` (부산); null outside Vercel / unknown.
 */
export function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country');
  const region = request.headers.get('x-vercel-ip-country-region');
  return json({ country: country ?? null, region: country === 'KR' && region ? region : null }, { maxAge: 0 });
}

export function OPTIONS() {
  return preflight();
}
