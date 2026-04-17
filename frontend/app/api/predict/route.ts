import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { home_team, away_team, date } = body;

    if (!home_team || !away_team) {
      return NextResponse.json(
        { error: 'home_team and away_team are required' },
        { status: 400 }
      );
    }

    const backendBaseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendBaseUrl}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ home_team, away_team, date })
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorPayload?.detail || 'Prediction backend request failed' },
        { status: response.status }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

