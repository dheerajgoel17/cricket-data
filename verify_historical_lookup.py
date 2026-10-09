#!/usr/bin/env python3
"""Verify historical lookup can find and scrape matches from CREX."""

from pathlib import Path
from cricket_data.backfill import BackfillTask, search_crex_for_match, process_backfill_batch, BackfillQueue
from cricket_data.scrapers import CREXScraper
from cricket_data.store import Store
from cricket_data.provisional import write_provisional
import time

def test_match_search_and_scrape(task: BackfillTask, scraper: CREXScraper, store: Store):
    """Test that we can find and scrape a specific match."""
    print(f"\nTesting: {task.date} {task.team_a} vs {task.team_b}")
    print("=" * 60)
    
    # Step 1: Search for match
    print("Step 1: Searching CREX...")
    match_id = search_crex_for_match(task, scraper)
    
    if match_id is None:
        print("  ✗ Not found on CREX")
        return False
    
    print(f"  ✓ Found: {match_id}")
    time.sleep(2)
    
    # Step 2: Scrape match data
    print("Step 2: Scraping match data...")
    match = scraper.fetch_match(match_id)
    
    if match is None:
        print("  ✗ Failed to scrape")
        return False
    
    print(f"  ✓ Scraped: {match.team_a} vs {match.team_b}")
    print(f"     Date: {match.date}")
    print(f"     Result: {match.result_margin or match.winner or 'Unknown'}")
    time.sleep(2)
    
    # Step 3: Save to provisional
    print("Step 3: Saving to provisional...")
    match.status = task.category
    write_provisional(store, match)
    print(f"  ✓ Saved: data/provisional/{match.match_id}.json")
    
    # Step 4: Verify saved
    prov_file = store.root / "provisional" / f"{match.match_id}.json"
    if prov_file.exists():
        print(f"  ✓ Verified: File exists")
        return True
    else:
        print(f"  ✗ Verification failed: File not found")
        return False

def main():
    print("Historical Lookup Verification")
    print("=" * 60)
    
    # Initialize
    store = Store("data")
    scraper = CREXScraper()
    
    # Test cases
    test_cases = [
        # Test 1: International match (2024)
        BackfillTask(
            date="2024-10-17",
            team_a="India",
            team_b="West Indies",
            match_type="T20I",
            gender="male",
            category="cricsheet_missing"
        ),
        # Test 2: Recent international (2026)
        BackfillTask(
            date="2026-10-09",
            team_a="India",
            team_b="West Indies",
            match_type="T20I",
            gender="male",
            category="provisional"
        ),
    ]
    
    results = []
    for task in test_cases:
        try:
            success = test_match_search_and_scrape(task, scraper, store)
            results.append((task, success))
        except Exception as exc:
            print(f"  ✗ Error: {exc}")
            results.append((task, False))
    
    # Cleanup
    try:
        if scraper._context:
            scraper._context.close()
        if scraper._browser:
            scraper._browser.close()
        if scraper._playwright:
            scraper._playwright.stop()
    except:
        pass
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    successful = sum(1 for _, s in results if s)
    total = len(results)
    
    for task, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {task.date} {task.team_a} vs {task.team_b}")
    
    print(f"\nTotal: {successful}/{total} tests passed")
    
    if successful == total:
        print("\n✓ All tests passed - historical lookup is working!")
        return 0
    else:
        print(f"\n✗ {total - successful} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
