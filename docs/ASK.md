# Ask questions in plain English

A Claude-powered assistant answers cricket questions from this dataset, for example:

* "Who won the toss in the last 5 India v West Indies T20Is, and where were they played?"
* "Axar Patel's record at Chepauk: last 5 internationals and last 5 IPL games"
* "In India's last 10 internationals at the Ranchi stadium, who won the toss?"

## Run it

```bash
pip install -e ".[bot]"
export ANTHROPIC_API_KEY=...        # or `ant auth login`

cricket-data ask "who won the toss in the last India v West Indies T20I?"
cricket-data chat                   # interactive, remembers the conversation
cricket-data serve --port 8000      # HTTP endpoint for a chat UI
```

`serve` takes `POST /ask` with `{"question": "...", "history": [{"role": "user", "content": "..."}]}` and
returns `{"answer": "...", "queries": [...], "seconds": 3.1}`. `GET /health` reports the data date.
It listens on localhost; set `CRICKET_BOT_TOKEN` (clients send `Authorization: Bearer <token>`) before
exposing it, because every question uses API credit. `--allow-origin https://your-ui` enables browser calls.

## How it stays fast

* The data is loaded once into an indexed SQLite file (`.cache/cricket.db`), rebuilt only when the data
  changes (about 10 seconds, then reused instantly). Lookups and queries take milliseconds.
* The model has two tools: `resolve_name` (maps "Cheapuk", "Windies", "Axar" to the names in the data) and
  `run_sql` (one read-only SELECT with a row cap and a 5 second limit). It looks up the names in one step,
  runs one aggregate query, and answers.
* The long schema/conventions prompt is cached between questions, and the model runs at low effort.
  Override the model with `--model` or `CRICKET_BOT_MODEL`.

## Safety

Queries run on a read-only connection; only a single SELECT is accepted (no writes, pragmas, attach or
multiple statements), results are capped at 200 rows, and anything the data cannot answer is reported as such.
