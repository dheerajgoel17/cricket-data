# Free API Keys Setup

This document lists all free cricket APIs that require signup (no credit card needed).

## Required Free API Keys

### 1. CricketData.org (formerly CricAPI)
**Tier:** Free - 100 requests/day  
**Signup:** https://cricketdata.org/  
**Cost:** Free forever, no credit card required  
**Setup:**
1. Go to https://cricketdata.org/
2. Click "Sign Up" or "Get API Key"
3. Create free account
4. Copy your API key
5. Add to GitHub Actions secrets:
   - Secret name: `CRICKETDATA_API_KEY`
   - Value: Your API key

**GitHub Actions:**
```bash
gh secret set CRICKETDATA_API_KEY
# Paste your key when prompted
```

### 2. RapidAPI Cricket (Optional)
**Tier:** Free tier available (limits vary by provider)  
**Signup:** https://rapidapi.com/hub  
**Search for:** "cricket" APIs with free tiers  
**Setup:**
1. Go to https://rapidapi.com/
2. Create free account
3. Search for "cricket" in API marketplace
4. Find API with free tier (e.g., "Cricket Live Data")
5. Subscribe to free plan
6. Copy your RapidAPI key
7. Add to GitHub Actions secrets:
   - Secret name: `RAPIDAPI_CRICKET_KEY`
   - Value: Your RapidAPI key

**Note:** RapidAPI has many cricket APIs - choose one with a genuine free tier.

## Local Development

Set environment variables:

```bash
# On Linux/Mac
export CRICKETDATA_API_KEY="your-key-here"
export RAPIDAPI_CRICKET_KEY="your-key-here"

# On Windows
set CRICKETDATA_API_KEY=your-key-here
set RAPIDAPI_CRICKET_KEY=your-key-here

# Then run
cricket-data update --enable-scraper
```

## Without API Keys

The scraper will work without keys but with limitations:
- **CREX**: Works (uses Playwright headless browser)
- **CricketData.org**: Skipped (requires key)
- **RapidAPI Cricket**: Skipped (requires key)
- **ESPNcricinfo**: Blocked (robots.txt)
- **Cricbuzz**: Blocked (robots.txt)

With just CREX (no keys needed), you get some matches.  
With CricketData.org key (free), you get reliable match data.

## API Limits & Best Practices

### CricketData.org
- **Limit:** 100 requests/day
- **Strategy:** 
  - Check current matches once every 6 hours (4 requests/day)
  - Fetch match details for new matches only
  - Stay well under limit

### RapidAPI Cricket
- **Limit:** Varies (typically 100-500/day on free tier)
- **Strategy:**
  - Use as backup to CricketData.org
  - Cache results
  - Check docs for specific limits

## Verification

Test your keys:

```bash
# Test CricketData.org
curl "https://api.cricapi.com/v1/currentMatches?apikey=YOUR_KEY&offset=0"

# Should return JSON with match data
```

## Troubleshooting

### "API error: fail"
- Check your API key is correct
- Verify you haven't exceeded daily limit
- Check API status page

### "Source skipped"
- API key not set in environment
- Check secret names match exactly:
  - `CRICKETDATA_API_KEY` (not CRICAPI_KEY or similar)
  - `RAPIDAPI_CRICKET_KEY`

### Rate Limit Exceeded
- Wait 24 hours for reset
- Reduce scraping frequency
- Consider using fewer sources

## Cost Summary

| Source | Cost | Signup | Credit Card | Daily Limit |
|--------|------|--------|-------------|-------------|
| CREX | Free | No | No | Unlimited* |
| CricketData.org | Free | Yes | No | 100 req/day |
| RapidAPI Cricket | Free | Yes | No | Varies |
| ESPNcricinfo | N/A | N/A | N/A | Blocked |
| Cricbuzz | N/A | N/A | N/A | Blocked |

*Subject to rate limiting and polite delay (5 seconds between requests)

## Recommended Setup

**Minimum** (Free, works today):
- No keys: CREX only (some matches)

**Recommended** (Free, 5 minutes setup):
- CricketData.org key: Reliable match data

**Maximum** (Free, 10 minutes setup):
- CricketData.org + RapidAPI: Multiple sources, conflict resolution
