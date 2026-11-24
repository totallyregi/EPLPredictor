import { NextResponse } from 'next/server';
import { backendFetch } from '../_backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const season = new URL(request.url).searchParams.get('season');
  try {
    const res = await backendFetch(`/api/analysis${season ? `?season=${encodeURIComponent(season)}` : ''}`);
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) return NextResponse.json({ error: payload?.detail || 'Analysis unavailable' }, { status: 503 });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ error: 'The prediction server is waking up. Try again in a moment.' }, { status: 503 });
  }
}
