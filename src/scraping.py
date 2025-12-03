"""
Web scraping module for Premier League match data from fbref.com
"""

import time
import re
from typing import List, Optional
import pandas as pd
import requests
from bs4 import BeautifulSoup


def fetch_raw_html(url: str, headers: Optional[dict] = None) -> str:
    """
    Fetch HTML content from a URL with proper headers.
    
    Args:
        url: URL to fetch
        headers: Optional custom headers (default includes User-Agent)
    
    Returns:
        HTML content as string
    
    Raises:
        requests.RequestException: If request fails
    """
    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.text


def parse_standings_table(html: str) -> List[str]:
    """
    Extract team URLs from the Premier League standings table.
    
    Args:
        html: HTML content of the standings page
    
    Returns:
        List of relative team URLs (e.g., ['/squads/Arsenal-Stats', ...])
    
    Raises:
        ValueError: If standings table not found
    """
    soup = BeautifulSoup(html, 'lxml')
    standings_table = soup.select('table.stats_table')
    
    if not standings_table:
        raise ValueError("Standings table not found in HTML")
    
    links = standings_table[0].find_all('a')
    team_urls = [l.get("href") for l in links if l.get("href") and '/squads/' in l.get("href")]
    
    if not team_urls:
        raise ValueError("No team URLs found in standings table")
    
    return team_urls


def parse_team_matches(html: str) -> pd.DataFrame:
    """
    Parse the "Scores & Fixtures" table from a team page.
    
    Args:
        html: HTML content of a team page
    
    Returns:
        DataFrame with match data
    
    Raises:
        ValueError: If matches table not found
    """
    try:
        matches = pd.read_html(html, match="Scores & Fixtures")[0]
        return matches
    except (ValueError, IndexError) as e:
        raise ValueError(f"Could not find 'Scores & Fixtures' table: {e}")


def parse_shooting_stats(html: str) -> pd.DataFrame:
    """
    Parse the "Shooting" stats table from a team page.
    
    Args:
        html: HTML content of a team page
    
    Returns:
        DataFrame with shooting statistics
    
    Raises:
        ValueError: If shooting table not found or missing required columns
    """
    soup = BeautifulSoup(html, 'lxml')
    links = soup.find_all('a')
    shooting_links = [l.get("href") for l in links if l and l.get("href") and 'all_comps/shooting/' in l.get("href")]
    
    if not shooting_links:
        raise ValueError("Shooting stats link not found")
    
    shooting_url = f"https://fbref.com{shooting_links[0]}"
    data = fetch_raw_html(shooting_url)
    
    try:
        shooting = pd.read_html(data, match="Shooting")[0]
        # Handle multi-level column headers
        if isinstance(shooting.columns, pd.MultiIndex):
            shooting.columns = shooting.columns.droplevel()
        return shooting
    except (ValueError, IndexError) as e:
        raise ValueError(f"Could not find 'Shooting' table: {e}")


def scrape_season(year: int, base_url: str, delay: float = 1.0) -> List[pd.DataFrame]:
    """
    Scrape one season of Premier League data for all teams.
    
    Args:
        year: Season year (e.g., 2022 for 2021-22 season)
        base_url: Base URL for the standings page
        delay: Delay between requests in seconds
    
    Returns:
        List of DataFrames, one per team
    """
    all_matches = []
    
    # Fetch standings page
    html = fetch_raw_html(base_url)
    team_urls = parse_standings_table(html)
    team_urls = [f"https://fbref.com{url}" for url in team_urls]
    
    # Get previous season link for next iteration
    soup = BeautifulSoup(html, 'lxml')
    prev_season_link = soup.select("a.prev")
    next_base_url = None
    if prev_season_link:
        next_base_url = f"https://fbref.com{prev_season_link[0].get('href')}"
    
    # Scrape each team
    for team_url in team_urls:
        try:
            team_name = team_url.split("/")[-1].replace("-Stats", "").replace("-", " ")
            
            # Get matches
            team_html = fetch_raw_html(team_url)
            matches = parse_team_matches(team_html)
            
            # Get shooting stats
            shooting = parse_shooting_stats(team_html)
            
            # Merge on Date
            try:
                # Ensure Date columns are compatible
                matches['Date'] = pd.to_datetime(matches['Date'], errors='coerce')
                shooting['Date'] = pd.to_datetime(shooting['Date'], errors='coerce')
                
                # Select required columns from shooting
                shooting_cols = ["Date", "Sh", "SoT", "Dist", "FK", "PK", "PKatt"]
                available_cols = [col for col in shooting_cols if col in shooting.columns]
                
                if not available_cols:
                    print(f"Warning: No shooting columns found for {team_name}, skipping")
                    continue
                
                team_data = matches.merge(
                    shooting[["Date"] + [col for col in available_cols if col != "Date"]],
                    on="Date",
                    how="inner"
                )
                
                # Filter for Premier League only
                if "Comp" in team_data.columns:
                    team_data = team_data[team_data["Comp"] == "Premier League"].copy()
                
                # Add season and team
                team_data["Season"] = year
                team_data["Team"] = team_name
                
                all_matches.append(team_data)
                
            except (ValueError, KeyError) as e:
                print(f"Warning: Could not merge data for {team_name}: {e}")
                continue
            
            time.sleep(delay)
            
        except Exception as e:
            print(f"Error scraping {team_url}: {e}")
            continue
    
    return all_matches, next_base_url


def scrape_all_seasons(years: List[int], delay: float = 1.0) -> pd.DataFrame:
    """
    Scrape multiple seasons of Premier League data.
    
    Args:
        years: List of season years to scrape (e.g., [2022, 2021])
        delay: Delay between requests in seconds
    
    Returns:
        Combined DataFrame with all matches
    """
    base_url = "https://fbref.com/en/comps/9/Premier-League-Stats"
    all_season_matches = []
    
    for year in years:
        print(f"Scraping season {year}...")
        try:
            matches, next_url = scrape_season(year, base_url, delay)
            all_season_matches.extend(matches)
            base_url = next_url  # Use previous season URL for next iteration
        except Exception as e:
            print(f"Error scraping season {year}: {e}")
            continue
    
    if not all_season_matches:
        raise ValueError("No matches scraped successfully")
    
    # Combine all matches
    match_df = pd.concat(all_season_matches, ignore_index=True)
    
    # Normalize column names to lowercase
    match_df.columns = [c.lower() for c in match_df.columns]
    
    return match_df


def scrape_upcoming_fixtures() -> pd.DataFrame:
    """
    Scrape upcoming Premier League fixtures from fbref.
    
    Returns:
        DataFrame with upcoming fixtures (date, home_team, away_team, etc.)
    """
    try:
        # Try to get fixtures from the schedule page
        schedule_url = "https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures"
        html = fetch_raw_html(schedule_url)
        
        # Parse fixtures table
        try:
            fixtures_table = pd.read_html(html, match="Scores & Fixtures")[0]
            
            # Filter for future matches (no result or empty result)
            if 'Result' in fixtures_table.columns:
                fixtures_df = fixtures_table[
                    fixtures_table['Result'].isna() | 
                    (fixtures_table['Result'] == '') |
                    (fixtures_table['Result'].astype(str).str.strip() == '')
                ].copy()
            else:
                fixtures_df = fixtures_table.copy()
            
            # Rename columns to standard format
            column_mapping = {
                'Date': 'date',
                'Time': 'time',
                'Home': 'home',
                'Away': 'away',
                'Home.1': 'home',
                'Away.1': 'away'
            }
            
            for old_col, new_col in column_mapping.items():
                if old_col in fixtures_df.columns:
                    fixtures_df = fixtures_df.rename(columns={old_col: new_col})
            
            # Ensure we have required columns
            required_cols = ['date', 'home', 'away']
            if not all(col in fixtures_df.columns for col in required_cols):
                # Try alternative column names
                if 'Home' in fixtures_df.columns:
                    fixtures_df['home'] = fixtures_df['Home']
                if 'Away' in fixtures_df.columns:
                    fixtures_df['away'] = fixtures_df['Away']
                if 'Date' in fixtures_df.columns:
                    fixtures_df['date'] = fixtures_df['Date']
            
            # Select and return only needed columns
            output_cols = ['date', 'home', 'away']
            if 'time' in fixtures_df.columns:
                output_cols.append('time')
            
            return fixtures_df[[col for col in output_cols if col in fixtures_df.columns]]
            
        except (ValueError, IndexError, KeyError) as e:
            print(f"Could not parse fixtures table: {e}")
            return pd.DataFrame(columns=['date', 'home', 'away', 'time'])
            
    except Exception as e:
        print(f"Error scraping fixtures: {e}")
        return pd.DataFrame(columns=['date', 'home', 'away', 'time'])


def save_matches(df: pd.DataFrame, path: str):
    """
    Save matches DataFrame to CSV file.
    
    Args:
        df: DataFrame to save
        path: Output file path
    """
    df.to_csv(path, index=False)
    print(f"Saved {len(df)} matches to {path}")


def load_matches(path: str) -> pd.DataFrame:
    """
    Load matches from CSV file.
    
    Args:
        path: Input file path
    
    Returns:
        DataFrame with match data
    """
    return pd.read_csv(path)

