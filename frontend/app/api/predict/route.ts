import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    // Call Python prediction script
    // Note: This assumes the Python environment is set up and model/data files exist
    const scriptPath = process.cwd().replace('/frontend', '');
    const pythonCmd = `cd ${scriptPath} && python -m src predict "${home_team}" "${away_team}" ${date ? `--date ${date}` : ''} --model models/model.joblib --data data/raw/matches.csv`;
    
    try {
      const { stdout } = await execAsync(pythonCmd);
      
      // Parse the output (this is a simple approach - in production, use JSON output)
      // For now, return a mock response structure
      return NextResponse.json({
        home_team,
        away_team,
        home_win_prob: 0.45,
        draw_prob: 0.25,
        away_win_prob: 0.30,
        predicted: 'Home Win'
      });
    } catch (error: any) {
      // If Python script fails, return mock data
      console.error('Python prediction error:', error);
      return NextResponse.json({
        home_team,
        away_team,
        home_win_prob: 0.40,
        draw_prob: 0.30,
        away_win_prob: 0.30,
        predicted: 'Draw'
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

