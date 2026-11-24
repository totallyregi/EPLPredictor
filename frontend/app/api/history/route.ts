import { NextResponse } from 'next/server';
import { backendFetch } from '../_backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const limit = new URL(request.url).searchParams.get('limit') || '10';
  try {
    const res = await backendFetch(`/api/history?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) return NextResponse.json({ history: [], error: 'History unavailable' }, { status: 503 });
    return NextResponse.json(await res.json(), { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ history: [], error: 'History unavailable' }, { status: 503 });
  }
}
