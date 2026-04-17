import { NextResponse } from 'next/server';

function fallbackPrediction(fixture: any) {
  const seed = `${fixture.home}-${fixture.away}`
    .split('')
    .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

  const homeWinProb = 0.36 + (seed % 8) / 100;
  const drawProb = 0.24 + (seed % 5) / 100;
  const awayWinProb = Math.max(0.1, 1 - homeWinProb - drawProb);
  const total = homeWinProb + drawProb + awayWinProb;

  const normalizedHome = homeWinProb / total;
  const normalizedDraw = drawProb / total;
  const normalizedAway = awayWinProb / total;

  const predicted =
    normalizedHome >= normalizedDraw && normalizedHome >= normalizedAway
      ? 'Home Win'
      : normalizedAway >= normalizedDraw
      ? 'Away Win'
      : 'Draw';

  return {
    ...fixture,
    home_win_prob: Number(normalizedHome.toFixed(4)),
    draw_prob: Number(normalizedDraw.toFixed(4)),
    away_win_prob: Number(normalizedAway.toFixed(4)),
    predicted,
    predicted_score: predicted === 'Draw' ? '1-1' : predicted === 'Home Win' ? '2-1' : '1-2',
    prediction_source: 'fallback'
  };
}

export async function GET(request: Request) {
  try {
    const appBaseUrl = new URL(request.url).origin;
    const fixturesRes = await fetch(`${appBaseUrl}/api/fixtures`);
    if (!fixturesRes.ok) {
      return NextResponse.json(
        { error: 'Failed to load fixtures for predictions' },
        { status: fixturesRes.status }
      );
    }
    const { fixtures } = await fixturesRes.json();

    const fixturesList = Array.isArray(fixtures) ? fixtures : [];

    const predictions = await Promise.all(
      fixturesList.map(async (fixture: any) => {
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
          if (!res.ok) {
            return fallbackPrediction(fixture);
          }
          const prediction = await res.json();
          if (
            prediction?.home_win_prob === undefined ||
            prediction?.draw_prob === undefined ||
            prediction?.away_win_prob === undefined
          ) {
            return fallbackPrediction(fixture);
          }
          return { ...fixture, ...prediction };
        } catch (error) {
          return fallbackPrediction(fixture);
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

