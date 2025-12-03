import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch fixtures first
    const fixturesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fixtures`);
    const { fixtures } = await fixturesRes.json();

    // Generate predictions for all fixtures
    const predictions = await Promise.all(
      fixtures.map(async (fixture: any) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/predict`, {
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
          return { ...fixture, error: 'Prediction failed' };
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

