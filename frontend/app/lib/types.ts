export type Outcome = 'H' | 'D' | 'A';

export interface FormEntry { result: 'W' | 'D' | 'L'; score: string; opponent: string; home: boolean; date: string }

export interface Prediction {
  match_id?: number;
  matchday?: number | null;
  kickoff: string;
  date: string;
  home: string; away: string;
  home_short: string; away_short: string;
  home_crest?: string; away_crest?: string;
  home_win_prob: number; draw_prob: number; away_win_prob: number;
  expected_home_goals: number; expected_away_goals: number;
  predicted: 'Home Win' | 'Draw' | 'Away Win';
  predicted_score: string;
  top_scores: { score: string; prob: number }[];
  both_teams_score_prob: number;
  over_2_5_prob: number;
  score_matrix: number[][];
}

export interface TableRow {
  team: string; short: string; crest?: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number;
  projected_points: number; projected_position: number;
  title: number; top4: number; relegation: number;
  attack: number; defence: number;
}

export interface Backtest {
  matches: number; accuracy: number; home_win_baseline: number; exact_score_rate: number;
  log_loss: number; uniform_log_loss: number; brier: number;
  calibration: { bucket: string; predicted: number; observed: number; n: number }[];
}

export interface ModelInfo {
  name: string; trained_on_matches: number; seasons: number[];
  home_advantage: number | null; avg_goals_per_match: number | null;
  updated_at: string | null; backtest: Backtest | null; simulations: number;
}

export interface TrackRecord {
  date: string; home: string; away: string; home_short: string; away_short: string;
  home_crest?: string; away_crest?: string; score: string; predicted_score: string;
  pick: Outcome; actual: Outcome; correct: boolean; probs: Record<Outcome, number>;
}

export interface Result {
  date: string; matchday: number | null; home: string; away: string;
  home_short: string; away_short: string; home_crest?: string; away_crest?: string; score: string;
}

export interface Dashboard {
  model: ModelInfo;
  predictions: Prediction[];
  table: TableRow[];
  teams: { team: string; short: string; crest?: string }[];
  results: Result[];
  form: Record<string, FormEntry[]>;
  track_record: TrackRecord[];
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
