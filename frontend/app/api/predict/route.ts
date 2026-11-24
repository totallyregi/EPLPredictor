import { NextResponse } from 'next/server';
import { backendFetch } from '../_backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body?.home_team || !body?.away_team) {
    return NextResponse.json({ error: 'home_team and away_team are required' }, { status: 400 });
  }
  try {
    const res = await backendFetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: payload?.detail || 'Prediction failed' }, { status: res.status });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Prediction server unavailable' }, { status: 503 });
  }
}
