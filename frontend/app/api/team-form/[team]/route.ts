import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { team: string } }
) {
  try {
    const team = decodeURIComponent(params.team);
    
    // TODO: Implement actual team form fetching from Python backend
    // For now, return mock data
    return NextResponse.json({
      team,
      wins: 3,
      draws: 1,
      losses: 1,
      goals_for: 8,
      goals_against: 4,
      points: 10,
      form: '3W-1D-1L'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch team form' },
      { status: 500 }
    );
  }
}

