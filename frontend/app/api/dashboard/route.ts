import { NextResponse } from 'next/server';
import { backendFetch } from '../_backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const res = await backendFetch('/api/dashboard');
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload) {
      return NextResponse.json(
        { error: payload?.detail || 'The prediction service is unavailable right now.', waking: res.status >= 502 },
        { status: 503 }
      );
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=900' } });
  } catch {
    return NextResponse.json(
      { error: 'The prediction server is waking up. This takes up to a minute on free hosting.', waking: true },
      { status: 503 }
    );
  }
}
