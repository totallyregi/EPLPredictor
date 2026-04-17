import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const years = searchParams.get('years') || '5';
    const backendBaseUrl = process.env.BACKEND_API_URL || 'http://localhost:8000';

    const response = await fetch(`${backendBaseUrl}/api/history?years=${years}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch historical data' },
        { status: response.status }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: 'History API request failed' },
      { status: 500 }
    );
  }
}

