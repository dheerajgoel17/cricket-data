import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LEGAL_NAV } from "@/components/layout/nav";
import { setTitle } from "@/lib/title";
import { Crumbs, Muted, PageTitle } from "@/components/app/page";
import { Card } from "@/components/ui/card";

const UPDATED = "31 October 2026";

function LegalNav({ current }: { current: string }) {
  return (
    <nav aria-label="Legal pages" className="flex flex-wrap gap-snug">
      {LEGAL_NAV.map(([label, to]) => (
        to === current
          ? <span key={to} className="text-callout font-semibold text-foreground">{label}</span>
          : <Link key={to} to={to} className="text-callout text-primary">{label}</Link>
      ))}
      <Link to="/about" className="text-callout text-primary">Rules &amp; data</Link>
    </nav>
  );
}

function LegalDoc({ title, sub, path, crumbs, children }: { title: string; sub: string; path: string; crumbs: string; children: ReactNode }) {
  setTitle(title);
  return (
    <div className="flex flex-col gap-stack">
      <Crumbs items={[["Home", "/"], [crumbs]]} />
      <PageTitle sub={sub}>{title}</PageTitle>
      <p className="text-footnote text-muted-foreground">Last updated {UPDATED}.</p>
      <Card className="flex flex-col gap-stack px-inset py-stack shadow-none text-callout text-muted-foreground [&_h2]:text-body [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-tight">{children}</Card>
      <LegalNav current={path} />
      <Muted>Fancy.cash is a free cricket stats and data site. It does not offer, promote or encourage gambling.</Muted>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalDoc title="Privacy policy" sub="What this site stores on your device, and what anonymous counts we keep." path="/privacy-policy" crumbs="Privacy">
      <h2>Who we are</h2>
      <p>Fancy.cash is a free cricket stats and data website: hit rates, form, grounds and listed market prices shown as context next to that history. There are no accounts and no sign-in. This page describes the little that is stored so the site can run, and the anonymous counts used to see which pages are used.</p>

      <h2>What stays on your device</h2>
      <ul>
        <li><b>Saved players and teams</b> live in this browser only (the star on a player or team page). Clearing site data removes them. They are never sent to us.</li>
        <li><b>Live scores cache</b> keeps the last live snapshot on the device for about 30 minutes so a revisit can paint quickly.</li>
      </ul>

      <h2>Cookies we set</h2>
      <ul>
        <li>A short-lived <b>gate cookie</b> is used only so the data files can load. It is not a tracking cookie and is not used to identify you.</li>
        <li>The desktop sidebar remembers open or collapsed in a <b>sidebar cookie</b> on this device.</li>
      </ul>

      <h2>Analytics</h2>
      <p>We count page views and a few named button taps (for example opening extra books, sharing a player). We do not collect a name, email, or account.</p>
      <ul>
        <li><b>Host analytics</b> (when enabled on the host) counts visits without cookies and without personal data.</li>
        <li><b>Google Analytics 4</b> loads only when a measurement id is configured at build. Ads cookies stay off. The tag records the path, referrer, device class, language, and an anonymous country/region from the edge request headers. Headless and crawler browsers are flagged as bots. There is no consent banner because ads stay off and there is no account; you can block the tag with a browser privacy tool.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>No accounts, no mailing list, no sale of personal data, no advertising network, no affiliate links to place a bet.</li>
        <li>We do not take wagers. Book names and logos are shown only to say which source a listed price came from.</li>
      </ul>

      <h2>Children</h2>
      <p>The site is cricket statistics for a general audience. It is not directed at children.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the top of the page changes. Keep using the site only if the current policy is acceptable.</p>
    </LegalDoc>
  );
}

export function TermsPage() {
  return (
    <LegalDoc title="Terms of use" sub="Fancy.cash is free cricket stats and data. It is not a betting service." path="/terms-of-use" crumbs="Terms">
      <h2>The service</h2>
      <p>Fancy.cash publishes cricket statistics from open ball-by-ball data and provisional scorecards: hit rates, form, partnerships, grounds and match markets. Where a book has listed a decimal price, that figure is shown as market data next to the history, so you can see what was priced. The site is informational. It does not offer, promote or encourage gambling. It is not a bookmaker, exchange or broker. You cannot stake money here, and we do not send you to place a bet.</p>

      <h2>How to read the numbers</h2>
      <p>Hit rates, fair prices and “edge” figures are historical rates on the filtered sample. They are not a prediction, not a tip, and not a recommendation to wager. Models are rough. Small samples mislead. Void and DNP rules are described on <Link to="/about" className="text-primary">Rules &amp; data</Link>.</p>

      <h2>Prices and marks</h2>
      <p>Decimal prices and book names or logos are attribution: they say which source listed that line. Those names and logos are trademarks of their owners. A missing or stale price is possible: the data jobs run on a schedule and can lag. A book’s own rules still govern any market it offers; this site does not settle wagers.</p>

      <h2>Accuracy</h2>
      <p>Live scores can lag about 20 seconds and come from unofficial pages. Provisional matches fill a gap until the canonical ball-by-ball data is published. We try to keep the stats rules consistent; they are for reading history, not for placing a bet.</p>

      <h2>Your use</h2>
      <ul>
        <li>Do not overload the site, scrape the data files in a way that harms other visitors, or present this service as a licensed betting operator.</li>
        <li>Saved items stay on your device. You are responsible for that device.</li>
      </ul>

      <h2>Software and data</h2>
      <p>The website software is source-available under the Functional Source License. Match files keep the licence the canonical source publishes (CC BY-SA for those files). Photos belong to their owners.</p>

      <h2>Liability</h2>
      <p>The site is provided free, as is. We are not liable for decisions you make from a number on the page, or for missed or stale data. If a part of these terms cannot be enforced, the rest still applies.</p>

      <h2>Changes</h2>
      <p>We may change the site or these terms. The date at the top is the current version.</p>
    </LegalDoc>
  );
}

export function DisclaimerPage() {
  return (
    <LegalDoc title="Docs" sub="A cricket stats and data site. We do not offer, promote or encourage gambling." path="/docs" crumbs="Docs">
      <h2>What this site is</h2>
      <p>Fancy.cash is a free cricket statistics site. The numbers come from ball-by-ball data and scorecards: how often a player has cleared a line, form, grounds, partnerships and match markets. Where books have published a decimal price, we show that price as data next to the history, with the book’s mark so you can see the source.</p>

      <h2>What this site is not</h2>
      <ul>
        <li>Not a bookmaker, betting exchange or broker.</li>
        <li>No wallet, no stake, no payout, no “bet now” and no affiliate offers.</li>
        <li>We do not promote or encourage gambling, and we do not tell you to wager.</li>
      </ul>

      <h2>How to use the numbers</h2>
      <p>Treat every rate as history on the sample shown. A high hit rate or a positive edge is not a promise and not a tip. Samples are often small; the page always shows how many games went into a figure. Read <Link to="/glossary" className="text-primary">Stats explained</Link> for the definitions.</p>

      <h2>Other pages</h2>
      <p>Settlement rules and data sources are on <Link to="/about" className="text-primary">Rules &amp; data</Link>. Device storage and analytics are on the privacy policy. The terms of use are the rules for using the site.</p>
    </LegalDoc>
  );
}
