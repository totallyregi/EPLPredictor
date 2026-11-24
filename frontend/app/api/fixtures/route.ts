import { NextResponse } from 'next/server';
import { backendFetch } from '../_backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const res = await backendFetch('/api/fixtures/week');
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch fixtures from backend' }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Fixtures API request failed' }, { status: 503 });
  }
}
