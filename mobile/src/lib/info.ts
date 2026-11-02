// The words behind the small "i" buttons: what a number on a row means. Short, and the same as the site's glossary (site/src/pages/Simple.tsx).
export interface Info { title: string; points: [term: string, text: string][] }

export const INFO: Record<string, Info> = {
  "player-props": {
    title: "Reading a prop row",
    points: [
      ["O 19.5 Runs", "The line a book prices: over means strictly more than 19.5."],
      ["Edge", "Expected profit per unit at the best over price, using his hit rate (pulled toward the market for small samples). Not a stake size and not a promise; shown once he has enough games."],
      ["7 in L10", "In his last 10 games he cleared the line 7 times. Games he did not play are left out."],
      ["Ground", "How often he cleared it at this match's ground."],
      ["Bars", "His last games against the dashed line: green over, red under, amber push, grey did not play."],
    ],
  },
  "hit-rate": {
    title: "Hit rate",
    points: [
      ["What it is", "The share of games where the stat cleared the line. Over means strictly more than the line; under, strictly less."],
      ["Pushes", "Landing exactly on a whole-number line is void and not counted."],
      ["Left out", "Games he did not play, or was named in the XI but never batted or bowled."],
    ],
  },
  "fair-odds": {
    title: "Fair odds",
    points: [
      ["What it is", "1 ÷ hit rate: the decimal price at which his past rate breaks even."],
      ["What it ignores", "Bookmaker margin, form, pitch and the XIs. A price to read statistics against, not a prediction."],
    ],
  },
  "next-match": {
    title: "Reading this match",
    points: [
      ["Hit rate", "Counts the games he played on this line, in this format only. Other formats are never mixed in."],
      ["Left out", "Games he did not play (DNP) or that were void are left out, not counted as misses."],
      ["Fair odds", "1 ÷ hit rate. They carry no bookmaker margin, so compare them with the listed price."],
      ["At the ground, against them", "His rate on this line in games at this ground and against this side, from the games on the chart."],
    ],
  },
  "tournament-stats": {
    title: "About these stats",
    points: [
      ["Format", "One format at a time, never mixed with another."],
      ["Counting rules", "Super overs are ignored. Retired hurt is not an out."],
      ["Minimums", "Averages, strike rates and economy need a minimum number of balls, shown on each list."],
    ],
  },
  "season-trend": {
    title: "Season by season",
    points: [
      ["Seasons", "Those with at least three counted matches; matches that count for summary markets only (void games out)."],
      ["Tap a bar", "Opens that season."],
    ],
  },
  chart: {
    title: "About this chart",
    points: [
      ["Bars", "One per game, oldest on the left, against the line. Green cleared, red missed, amber pushed, grey did not play."],
      ["Counted", "Games he did not play, or that were void, are left out of every rate."],
      ["Windows", "L5, L10 and so on look back over that many games; All is every game on the chart."],
    ],
  },
  tape: {
    title: "Market tape",
    points: [
      ["High odds hits", "Overs priced at 2.50 or longer that have already cleared."],
      ["Low odds misses", "Overs priced at 1.40 or shorter that have already missed."],
      ["Source", "Scorecards from the live feed, refreshed about every 15 seconds."],
    ],
  },
};
