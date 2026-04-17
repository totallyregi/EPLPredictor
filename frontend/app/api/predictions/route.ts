import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const fixturesRes = await fetch(`${appBaseUrl}/api/fixtures`);
    if (!fixturesRes.ok) {
      return NextResponse.json(
        { error: 'Failed to load fixtures for predictions' },
        { status: fixturesRes.status }
      );
    }
    const { fixtures } = await fixturesRes.json();

    const predictions = await Promise.all(
      fixtures.map(async (fixture: any) => {
        try {
          const res = await fetch(`${appBaseUrl}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              home_team: fixture.home,
              away_team: fixture.away,
              date: fixture.date
            })
          });
          const prediction = await res.json();
          return { ...fixture, ...prediction };
        } catch (error) {
          return {
            ...fixture,
            home_win_prob: 0.34,
            draw_prob: 0.33,
            away_win_prob: 0.33,
            predicted: 'Unavailable',
            predicted_score: 'N/A',
            error: 'Prediction failed'
          };
        }
      })
    );

    return NextResponse.json({ predictions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}

