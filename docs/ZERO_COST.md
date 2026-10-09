# Zero-cost guarantee

This project must cost nothing to run, forever. How that is achieved, and what to watch:

| Piece | Where it runs | Cost |
|---|---|---|
| Daily + weekly jobs | GitHub Actions on a **public** repo | Free, unlimited minutes |
| Storage | Plain gzip CSV files in git (~12 MB today) | Free (GitHub recommends < 1 GB) |
| Hosting / API | None. Users clone, or download the data | Free |
| Database | None required; SQLite file generated on demand | Free |
| Data source | Cricsheet public downloads | Free |
| Secrets / paid accounts | None used. No cloud accounts, no API keys | Free |

## Keeping it small
- Month-partitioned files: a daily update rewrites only the current month's two small files, and only if
  something changed. Reruns are byte-identical (no commit).
- The downloaded Cricsheet zip is deleted right after parsing (temp file, never committed).
- Provisional files are deleted automatically when the real match lands.
- Rough growth: ~30-50 MB of git history per year. The daily job warns if `.git` passes 800 MB.
  If that ever happens: squash old history, or move the oldest months into a GitHub Release asset.

## Rules for contributors
Do not add anything that needs a credit card, an API key with billing, or a paid tier.
Free tiers that can lapse into paid ones count as paid.
