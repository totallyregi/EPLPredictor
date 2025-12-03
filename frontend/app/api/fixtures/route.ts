import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Fallback mock fixtures if scraping fails
const mockFixtures = [
  {
    date: '2024-01-15',
    home: 'Arsenal',
    away: 'Liverpool',
    time: '15:00'
  },
  {
    date: '2024-01-15',
    home: 'Manchester City',
    away: 'Tottenham',
    time: '17:30'
  },
  {
    date: '2024-01-16',
    home: 'Chelsea',
    away: 'Manchester Utd',
    time: '20:00'
  }
];

export async function GET() {
  try {
    // Try to scrape fixtures using Python
    const scriptPath = process.cwd().replace('/frontend', '');
    const pythonCmd = `cd ${scriptPath} && python -c "from src.scraping import scrape_upcoming_fixtures; import json; df = scrape_upcoming_fixtures(); print(df.to_json(orient='records'))"`;
    
    try {
      const { stdout } = await execAsync(pythonCmd, { timeout: 30000 });
      const fixtures = JSON.parse(stdout);
      
      if (fixtures && fixtures.length > 0) {
        return NextResponse.json({ fixtures });
      }
    } catch (error) {
      console.error('Python scraping error:', error);
      // Fall through to mock data
    }
    
    // Return mock data if scraping fails
    return NextResponse.json({ fixtures: mockFixtures });
  } catch (error) {
    console.error('Fixtures API error:', error);
    return NextResponse.json(
      { fixtures: mockFixtures }, // Return mock data on error
      { status: 200 }
    );
  }
}

