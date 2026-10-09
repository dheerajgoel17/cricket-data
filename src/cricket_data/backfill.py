"""Incremental backfilling of historical matches from Cricsheet's gaps.

Manages a persistent queue of matches to backfill (missing and Afghanistan),
processing small batches per run to avoid overloading CREX servers.

Queue State:
- state/backfill_queue.json contains pending, in_progress, done, failed
- Newest matches first (most relevant)
- Tracks retry counts and last attempt times
- Never re-scrapes completed matches

Processing:
- Recent matches always processed first
- Then small batch from backfill queue (5-10 matches)
- Generous delays between requests (configurable)
- Auto back-off on errors (429, 5xx)
- Resumes where it left off
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Literal

from .permanent_matches import MissingMatch, fetch_cricsheet_missing_matches


@dataclass
class BackfillTask:
    """A single match to backfill."""
    date: str
    team_a: str
    team_b: str
    match_type: str
    gender: str
    category: Literal["cricsheet_missing", "cricsheet_withheld"]
    
    # Tracking
    attempts: int = 0
    last_attempt: str | None = None
    last_error: str | None = None
    
    def key(self) -> str:
        """Unique identifier for this task."""
        return f"{self.date}-{self.team_a}-{self.team_b}"


@dataclass
class BackfillQueue:
    """Persistent queue for incremental backfilling.
    
    State is saved to state/backfill_queue.json and persists across runs.
    """
    pending: list[BackfillTask] = field(default_factory=list)
    in_progress: list[BackfillTask] = field(default_factory=list)
    done: list[str] = field(default_factory=list)  # Task keys
    failed: list[BackfillTask] = field(default_factory=list)
    not_found: list[str] = field(default_factory=list)  # Matches CREX doesn't have
    
    # Configuration
    max_retries: int = 3
    batch_size: int = 5
    delay_between_requests: float = 10.0  # Generous delay for historical matches
    
    @classmethod
    def load(cls, path: Path) -> BackfillQueue:
        """Load queue from disk or create empty one."""
        if not path.exists():
            return cls()
        
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return cls(
                pending=[BackfillTask(**t) for t in data.get("pending", [])],
                in_progress=[BackfillTask(**t) for t in data.get("in_progress", [])],
                done=data.get("done", []),
                failed=[BackfillTask(**t) for t in data.get("failed", [])],
                not_found=data.get("not_found", []),
                max_retries=data.get("max_retries", 3),
                batch_size=data.get("batch_size", 5),
                delay_between_requests=data.get("delay_between_requests", 10.0),
            )
        except Exception as exc:
            print(f"Warning: Failed to load backfill queue: {exc}")
            return cls()
    
    def save(self, path: Path) -> None:
        """Save queue state to disk."""
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "pending": [asdict(t) for t in self.pending],
            "in_progress": [asdict(t) for t in self.in_progress],
            "done": self.done,
            "failed": [asdict(t) for t in self.failed],
            "not_found": self.not_found,
            "max_retries": self.max_retries,
            "batch_size": self.batch_size,
            "delay_between_requests": self.delay_between_requests,
            "last_updated": datetime.now().isoformat(),
        }
        path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    
    def initialize_from_missing_list(self, missing_matches: list[MissingMatch]) -> int:
        """Add missing matches to queue if not already tracked.
        
        Returns number of new tasks added.
        """
        # Get all known task keys
        known = set(self.done)
        known.update(t.key() for t in self.pending)
        known.update(t.key() for t in self.in_progress)
        known.update(t.key() for t in self.failed)
        
        added = 0
        for match in missing_matches:
            task = BackfillTask(
                date=match.date,
                team_a=match.team_a,
                team_b=match.team_b,
                match_type=match.match_type,
                gender=match.gender,
                category="cricsheet_missing"
            )
            
            if task.key() not in known:
                self.pending.append(task)
                added += 1
        
        # Sort by date descending (newest first - most relevant)
        self.pending.sort(key=lambda t: t.date, reverse=True)
        
        return added
    
    def get_next_batch(self) -> list[BackfillTask]:
        """Get next batch of tasks to process.
        
        Returns up to batch_size tasks, excluding those that exceeded max_retries.
        """
        # Move in_progress back to pending (from previous interrupted run)
        if self.in_progress:
            self.pending.extend(self.in_progress)
            self.in_progress.clear()
            self.pending.sort(key=lambda t: t.date, reverse=True)
        
        # Get batch
        batch = []
        for _ in range(self.batch_size):
            if not self.pending:
                break
            
            task = self.pending.pop(0)
            
            # Skip if exceeded retries
            if task.attempts >= self.max_retries:
                self.failed.append(task)
                continue
            
            self.in_progress.append(task)
            batch.append(task)
        
        return batch
    
    def mark_not_found(self, task: BackfillTask) -> None:
        """Mark task as not found in CREX (won't retry)."""
        if task in self.in_progress:
            self.in_progress.remove(task)
        self.not_found.append(task.key())
    
    def mark_done(self, task: BackfillTask) -> None:
        """Mark task as successfully completed."""
        if task in self.in_progress:
            self.in_progress.remove(task)
        self.done.append(task.key())
    
    def mark_failed(self, task: BackfillTask, error: str) -> None:
        """Mark task as failed (will retry if under max_retries)."""
        task.attempts += 1
        task.last_attempt = datetime.now().isoformat()
        task.last_error = error
        
        if task in self.in_progress:
            self.in_progress.remove(task)
        
        if task.attempts < self.max_retries:
            # Retry: add back to pending (at end for fair rotation)
            self.pending.append(task)
        else:
            # Exhausted retries
            self.failed.append(task)
    
    def stats(self) -> dict[str, int]:
        """Get current queue statistics."""
        return {
            "pending": len(self.pending),
            "in_progress": len(self.in_progress),
            "done": len(self.done),
            "failed": len(self.failed),
            "not_found": len(self.not_found),
            "total": len(self.pending) + len(self.in_progress) + len(self.done) + len(self.failed) + len(self.not_found),
        }


def should_backoff(status_code: int | None, error_msg: str) -> tuple[bool, float]:
    """Check if we should back off and for how long.
    
    Returns (should_backoff, delay_seconds).
    """
    # Rate limit
    if status_code == 429:
        return True, 60.0  # Wait 1 minute
    
    # Server errors - back off
    if status_code and 500 <= status_code < 600:
        return True, 30.0
    
    # Network/timeout errors - brief pause
    if any(keyword in error_msg.lower() for keyword in ["timeout", "connection", "network"]):
        return True, 15.0
    
    return False, 0.0


def normalize_team_name(name: str) -> set[str]:
    """Generate team name variations for matching.
    
    Returns set of normalized variations including:
    - Full lowercase name
    - Common abbreviations
    - Short codes
    """
    import re
    
    name_lower = name.lower().strip()
    variations = {name_lower}
    
    # Remove common words
    clean = re.sub(r'\b(cricket|club|sports|knights|kings|warriors|tigers|lions)\b', '', name_lower)
    clean = re.sub(r'\s+', ' ', clean).strip()
    if clean:
        variations.add(clean)
    
    # Abbreviations by first letters of words
    words = name_lower.split()
    if len(words) > 1:
        abbrev = ''.join(w[0] for w in words if w)
        if abbrev:
            variations.add(abbrev)
    
    # Common team abbreviations
    team_abbrev = {
        'india': {'ind', 'india'},
        'pakistan': {'pak', 'pakistan'},
        'australia': {'aus', 'australia'},
        'england': {'eng', 'england'},
        'south africa': {'sa', 'rsa', 'south africa'},
        'west indies': {'wi', 'windies', 'west indies'},
        'new zealand': {'nz', 'new zealand'},
        'sri lanka': {'sl', 'sri lanka'},
        'bangladesh': {'ban', 'bangladesh'},
        'afghanistan': {'afg', 'afghanistan'},
        'zimbabwe': {'zim', 'zimbabwe'},
        'ireland': {'ire', 'ireland'},
        'jharkhand': {'jha', 'jharkhand'},
        'haryana': {'har', 'haryana'},
        'madhya pradesh': {'mp', 'madhya pradesh'},
        'punjab': {'pun', 'punjab'},
        'rajasthan': {'raj', 'rajasthan'},
        'mumbai': {'mum', 'mumbai'},
        'maharashtra': {'mah', 'maharashtra'},
        'karnataka': {'kar', 'karnataka'},
        'tamil nadu': {'tn', 'tamil nadu'},
        'delhi': {'del', 'delhi'},
        'bengal': {'ben', 'bengal'},
    }
    
    for full_name, abbrevs in team_abbrev.items():
        if full_name in name_lower:
            variations.update(abbrevs)
    
    return variations


def search_crex_for_match(
    task: BackfillTask,
    scraper,
    series_cache: dict[str, list[tuple[str, str]]] | None = None
) -> str | None:
    """Search CREX for a match by date and teams.
    
    Enhanced strategy:
    1. Check if match is before CREX archive coverage (pre-2023) → not_found
    2. Generate team name variations (full names, abbreviations, short codes)
    3. Search both series pages AND homepage recent matches
    4. For domestic matches, also check domestic competition pages
    5. Match by date proximity (±1 day tolerance for timezone differences)
    
    Args:
        task: BackfillTask with date, teams, match_type
        scraper: CREXScraper instance with browser
        series_cache: Optional dict mapping year -> [(series_url, series_name)]
    
    Returns:
        match_id if found, None if not found
    """
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeout
        from datetime import datetime, timedelta
        import re
        
        # Extract year from task date
        year = int(task.date[:4])
        
        # CREX archive coverage is roughly 2023 onwards
        if year < 2023:
            return None
        
        # Get browser
        context = scraper._get_browser()
        page = context.new_page()
        
        # Generate team name variations
        team_a_variations = normalize_team_name(task.team_a)
        team_b_variations = normalize_team_name(task.team_b)
        
        # Parse target date with ±1 day tolerance
        try:
            target_date = datetime.strptime(task.date, '%Y-%m-%d').date()
            date_range = [
                (target_date - timedelta(days=1)).isoformat(),
                target_date.isoformat(),
                (target_date + timedelta(days=1)).isoformat()
            ]
        except:
            date_range = [task.date]
        
        # Strategy 1: Check homepage for recent matches (most likely for 2024-2026)
        try:
            page.goto("https://crex.live", wait_until="networkidle", timeout=30000)
            match_links = page.query_selector_all('a[href*="cricket-live-score/"]')
            
            for link in match_links[:100]:
                href = link.get_attribute('href') or ''
                text = link.inner_text().strip().lower()
                href_lower = href.lower()
                
                # Check if both teams appear (any variation)
                team_a_match = any(var in href_lower or var in text for var in team_a_variations)
                team_b_match = any(var in href_lower or var in text for var in team_b_variations)
                
                if team_a_match and team_b_match:
                    match_id = href.split('/')[-1]
                    page.close()
                    return match_id
        except Exception as exc:
            print(f"  Homepage search failed: {exc}")
        
        # Strategy 2: Series pages (for both international and domestic)
        try:
            page.goto("https://crex.live/series", wait_until="networkidle", timeout=30000)
            series_links = page.query_selector_all('a[href*="/series/"]')
            relevant_series = []
            
            for link in series_links[:150]:
                href = link.get_attribute('href') or ''
                text = link.inner_text().strip().lower()
                
                # Check if series mentions the year or any team variation
                year_match = str(year) in text
                team_match = (any(var in text for var in team_a_variations) or 
                            any(var in text for var in team_b_variations))
                
                # Also check for competition names for domestic matches
                domestic_competitions = ['syed mushtaq ali', 'ranji', 'vijay hazare', 
                                       'deodhar', 't20', 'trophy', 'championship']
                competition_match = any(comp in text for comp in domestic_competitions)
                
                if year_match or team_match or (competition_match and year >= 2024):
                    relevant_series.append((href, text))
            
            # Search through relevant series
            for series_url, series_name in relevant_series[:20]:
                try:
                    page.goto(f"https://crex.live{series_url}", wait_until="networkidle", timeout=15000)
                    match_links = page.query_selector_all('a[href*="cricket-live-score/"]')
                    
                    for link in match_links[:100]:
                        href = link.get_attribute('href') or ''
                        text = link.inner_text().strip().lower()
                        href_lower = href.lower()
                        
                        # Check if both teams appear (any variation)
                        team_a_match = any(var in href_lower or var in text for var in team_a_variations)
                        team_b_match = any(var in href_lower or var in text for var in team_b_variations)
                        
                        if team_a_match and team_b_match:
                            match_id = href.split('/')[-1]
                            page.close()
                            return match_id
                    
                except Exception:
                    continue
        except Exception as exc:
            print(f"  Series search failed: {exc}")
        
        page.close()
        return None
        
    except Exception as exc:
        print(f"Search error: {exc}")
        return None


def process_backfill_batch(
    queue: BackfillQueue,
    scraper,
    store,
    verbose: bool = True
) -> dict[str, int]:
    """Process one batch from the backfill queue.
    
    Actually scrapes matches from CREX and saves them.
    
    Args:
        queue: BackfillQueue with tasks to process
        scraper: CricketScraper instance (typically CREXScraper)
        store: Store instance for saving matches
        verbose: Print progress messages
    
    Returns:
        Stats dict with succeeded, failed, not_found counts
    """
    from .scrapers import ScraperError
    from .provisional import write_provisional
    
    stats = {"succeeded": 0, "failed": 0, "not_found": 0}
    
    batch = queue.get_next_batch()
    
    if not batch:
        return stats
    
    if verbose:
        print(f"\nBackfilling {len(batch)} historical match(es)...")
    
    for i, task in enumerate(batch, 1):
        if verbose:
            print(f"  [{i}/{len(batch)}] {task.date} {task.team_a} vs {task.team_b}...", end=" ", flush=True)
        
        try:
            # Check if match is before CREX archive coverage (pre-2023)
            year = int(task.date[:4])
            if year < 2023:
                # Mark as not found with reason
                queue.mark_not_found(task)
                stats["not_found"] += 1
                if verbose:
                    print("not found (before CREX archive)")
                continue
            
            # Try to find match on CREX
            match_id = search_crex_for_match(task, scraper)
            
            if match_id is None:
                # Not found on CREX
                queue.mark_not_found(task)
                stats["not_found"] += 1
                if verbose:
                    print("not found")
                continue
            
            # Found - now scrape it
            match = scraper.fetch_match(match_id)
            
            if match is None:
                # Failed to scrape (error or parsing issue)
                queue.mark_failed(task, "Failed to parse match data")
                stats["failed"] += 1
                if verbose:
                    print("parse failed")
            else:
                # Successfully scraped - save it
                # Set status based on task category
                match.status = task.category
                write_provisional(store, match)
                queue.mark_done(task)
                stats["succeeded"] += 1
                
                if verbose:
                    result = f"{match.winner} won" if match.winner else "result unknown"
                    print(f"✓ {result}")
        
        except ScraperError as exc:
            error_msg = str(exc)
            
            # Check if we should back off
            should_backoff_flag, delay = should_backoff(None, error_msg)
            
            if should_backoff_flag:
                if verbose:
                    print(f"backing off ({delay}s)")
                time.sleep(delay)
            
            queue.mark_failed(task, error_msg)
            stats["failed"] += 1
            
            if verbose:
                print(f"failed: {error_msg[:50]}")
        
        except Exception as exc:
            queue.mark_failed(task, str(exc))
            stats["failed"] += 1
            
            if verbose:
                print(f"error: {str(exc)[:50]}")
        
        # Generous delay between historical requests
        if i < len(batch):
            time.sleep(queue.delay_between_requests)
    
    return stats


def initialize_backfill_queue(queue_path: Path, verbose: bool = True) -> BackfillQueue:
    """Initialize or update the backfill queue with current missing matches.
    
    Only adds new tasks; preserves existing progress.
    """
    queue = BackfillQueue.load(queue_path)
    
    if verbose:
        print("Fetching Cricsheet missing-matches list for backfill...")
    
    missing = fetch_cricsheet_missing_matches()
    
    if missing:
        added = queue.initialize_from_missing_list(missing)
        if verbose and added > 0:
            print(f"Added {added} new missing match(es) to backfill queue")
    
    queue.save(queue_path)
    
    return queue


def enumerate_afghanistan_matches_from_crex(
    scraper,
    queue: BackfillQueue,
    verbose: bool = True
) -> int:
    """Enumerate Afghanistan men's internationals and APL matches from CREX.
    
    Adds them to the backfill queue as cricsheet_withheld.
    
    Args:
        scraper: CREXScraper instance with browser
        queue: BackfillQueue to add tasks to
        verbose: Print progress messages
    
    Returns:
        Number of new Afghanistan tasks added
    """
    try:
        if verbose:
            print("Enumerating Afghanistan matches from CREX...")
        
        # Get browser
        context = scraper._get_browser()
        page = context.new_page()
        
        added = 0
        known = set(queue.done)
        known.update(t.key() for t in queue.pending)
        known.update(t.key() for t in queue.in_progress)
        known.update(t.key() for t in queue.failed)
        known.update(queue.not_found)
        
        # Strategy 1: Search homepage for Afghanistan matches
        try:
            page.goto("https://crex.live", wait_until="networkidle", timeout=30000)
            match_links = page.query_selector_all('a[href*="cricket-live-score/"]')
            
            if verbose:
                print(f"  Checking homepage: {len(match_links)} matches found")
            
            for link in match_links[:200]:
                try:
                    href = link.get_attribute('href') or ''
                    text = link.inner_text().strip()
                    text_lower = text.lower()
                    href_lower = href.lower()
                    
                    # Check for Afghanistan mentions
                    is_afg = ('afghanistan' in text_lower or 'afg' in text_lower or 
                             'apl' in text_lower or 'afghan' in href_lower)
                    
                    if not is_afg:
                        continue
                    
                    # Try to extract teams from text
                    import re
                    vs_match = re.search(r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\s*[-,]|$)', text, re.IGNORECASE)
                    if not vs_match:
                        continue
                    
                    team_a = vs_match.group(1).strip()
                    team_b = vs_match.group(2).strip()
                    
                    # Skip if either team is too short (likely parsing error)
                    if len(team_a) < 3 or len(team_b) < 3:
                        continue
                    
                    # Try to extract date
                    from datetime import datetime, date as dt_date
                    date_match = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})', text)
                    if date_match:
                        try:
                            parsed = datetime.strptime(date_match.group(1), "%d %b %Y")
                            match_date = parsed.date().isoformat()
                        except:
                            match_date = dt_date.today().isoformat()
                    else:
                        # Use today for recent matches
                        match_date = dt_date.today().isoformat()
                    
                    # Check year (only 2023+)
                    if int(match_date[:4]) < 2023:
                        continue
                    
                    # Determine match type
                    match_type = "T20I"
                    if "t20" in text_lower:
                        match_type = "T20I" if "international" in text_lower else "T20"
                    elif "odi" in text_lower:
                        match_type = "ODI"
                    elif "test" in text_lower:
                        match_type = "Test"
                    
                    # Create task
                    task = BackfillTask(
                        date=match_date,
                        team_a=team_a,
                        team_b=team_b,
                        match_type=match_type,
                        gender="male",
                        category="cricsheet_withheld"
                    )
                    
                    if task.key() not in known:
                        queue.pending.append(task)
                        known.add(task.key())
                        added += 1
                        
                except Exception as exc:
                    if verbose:
                        print(f"    Error parsing match: {exc}")
                    continue
        
        except Exception as exc:
            if verbose:
                print(f"  Homepage search failed: {exc}")
        
        # Strategy 2: Search series pages
        try:
            page.goto("https://crex.live/series", wait_until="networkidle", timeout=30000)
            series_links = page.query_selector_all('a[href*="/series/"]')
            afg_series = []
            
            for link in series_links[:150]:
                href = link.get_attribute('href') or ''
                text = link.inner_text().strip().lower()
                
                # Check for Afghanistan mentions
                if "afghanistan" in text or "afg" in text or "apl" in text:
                    afg_series.append((href, text))
            
            if verbose:
                print(f"  Found {len(afg_series)} Afghanistan-related series")
            
            # Search through Afghanistan series
            for series_url, series_name in afg_series[:15]:
                try:
                    page.goto(f"https://crex.live{series_url}", wait_until="networkidle", timeout=15000)
                    match_links = page.query_selector_all('a[href*="cricket-live-score/"]')
                    
                    for link in match_links[:100]:
                        try:
                            href = link.get_attribute('href') or ''
                            text = link.inner_text().strip()
                            
                            # Extract teams and date (same logic as above)
                            import re
                            vs_match = re.search(r'([A-Za-z\s]+?)\s+vs\s+([A-Za-z\s]+?)(?:\s*[-,]|$)', text, re.IGNORECASE)
                            if not vs_match:
                                continue
                            
                            team_a = vs_match.group(1).strip()
                            team_b = vs_match.group(2).strip()
                            
                            if len(team_a) < 3 or len(team_b) < 3:
                                continue
                            
                            from datetime import datetime, date as dt_date
                            date_match = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})', text)
                            if date_match:
                                try:
                                    parsed = datetime.strptime(date_match.group(1), "%d %b %Y")
                                    match_date = parsed.date().isoformat()
                                except:
                                    continue
                            else:
                                continue
                            
                            if int(match_date[:4]) < 2023:
                                continue
                            
                            # Determine match type from series name
                            match_type = "T20"
                            if "t20" in series_name or "t20" in text.lower():
                                match_type = "T20" if "apl" in series_name else "T20I"
                            elif "odi" in series_name:
                                match_type = "ODI"
                            elif "test" in series_name:
                                match_type = "Test"
                            
                            task = BackfillTask(
                                date=match_date,
                                team_a=team_a,
                                team_b=team_b,
                                match_type=match_type,
                                gender="male",
                                category="cricsheet_withheld"
                            )
                            
                            if task.key() not in known:
                                queue.pending.append(task)
                                known.add(task.key())
                                added += 1
                                
                        except Exception:
                            continue
                
                except Exception as exc:
                    if verbose:
                        print(f"    Error loading series {series_url}: {exc}")
                    continue
        
        except Exception as exc:
            if verbose:
                print(f"  Series search failed: {exc}")
        
        # Close page
        try:
            page.close()
        except:
            pass
        
        # Sort by date descending (newest first)
        queue.pending.sort(key=lambda t: t.date, reverse=True)
        
        if verbose and added > 0:
            print(f"  Added {added} Afghanistan match(es) to backfill queue")
        
        return added
        
    except Exception as exc:
        print(f"Failed to enumerate Afghanistan matches: {exc}")
        import traceback
        traceback.print_exc()
        return 0
