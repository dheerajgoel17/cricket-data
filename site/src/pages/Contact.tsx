/**
 * Contact (`/contact`): sixth tab. One inbox — tech@fancy.cash — with mailto chips for
 * business, tech, privacy/account and general. shadcn Card / Button; no form backend (free stack).
 */
import { Link } from "react-router-dom";
import { EnvelopeIcon, BuildingOffice2Icon, WrenchScrewdriverIcon, ShieldCheckIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { setTitle } from "@/lib/title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const INBOX = "tech@fancy.cash";

type Topic = {
  id: string;
  title: string;
  blurb: string;
  subject: string;
  icon: typeof EnvelopeIcon;
};

const TOPICS: Topic[] = [
  {
    id: "business",
    title: "Business & partnerships",
    blurb: "Sponsorship, media, or working together.",
    subject: "Business enquiry",
    icon: BuildingOffice2Icon,
  },
  {
    id: "tech",
    title: "Tech & product",
    blurb: "Bugs, wrong numbers, outages, or a feature idea.",
    subject: "Tech / product",
    icon: WrenchScrewdriverIcon,
  },
  {
    id: "privacy",
    title: "Privacy & account",
    blurb: "Saved data, sign-in, or a request to delete your account.",
    subject: "Privacy / account",
    icon: ShieldCheckIcon,
  },
  {
    id: "general",
    title: "General",
    blurb: "Anything else about Fancy.cash that does not fit above.",
    subject: "General enquiry",
    icon: ChatBubbleLeftRightIcon,
  },
];

function mailTo(subject: string, body?: string) {
  const q = new URLSearchParams({ subject: `[Fancy.cash] ${subject}` });
  if (body) q.set("body", body);
  return `mailto:${INBOX}?${q.toString()}`;
}

export function ContactPage() {
  setTitle("Contact");
  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-col gap-snug">
        <p className="label-cap text-footnote text-primary">Contact</p>
        <h1 className="text-display font-emphasis tracking-tight">Get in touch</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Fancy.cash is a free cricket stats site. Write for business, tech issues, privacy, or anything else —
          one inbox, we read it.
        </p>
      </header>

      <Card className="gap-stack border-hairline py-stack shadow-none">
        <CardHeader className="gap-snug px-inset [.border-b]:pb-0">
          <div className="flex items-center gap-snug">
            <span className="grid size-control place-items-center rounded-full bg-secondary text-primary">
              <EnvelopeIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-title font-emphasis tracking-tight">Email</CardTitle>
              <CardDescription className="text-callout">Opens your mail app with the subject filled in.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-stack px-inset">
          <a
            href={mailTo("Hello")}
            className="font-condensed text-stat font-emphasis tracking-tight text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {INBOX}
          </a>
          <Button asChild className="h-(--touch) w-full rounded-full text-body sm:w-fit">
            <a href={mailTo("Hello")}>
              <EnvelopeIcon className="size-4" aria-hidden />
              Email {INBOX}
            </a>
          </Button>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-snug" aria-label="What to write about">
        <h2 className="text-title font-label tracking-tight">What is it about?</h2>
        <ul className="grid gap-snug sm:grid-cols-2">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.id}>
                <Card className="h-full gap-snug border-hairline py-stack shadow-none transition-colors hover:bg-surface-raised">
                  <CardHeader className="gap-snug px-inset">
                    <span className="grid size-control place-items-center rounded-full bg-secondary text-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <CardTitle className="text-body font-label">{t.title}</CardTitle>
                    <CardDescription className="text-callout text-muted-foreground">{t.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-inset">
                    <Button asChild variant="secondary" className="h-control rounded-full text-callout">
                      <a href={mailTo(t.subject)}>Write about this</a>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <Separator className="bg-hairline" />

      <section className="flex flex-col gap-snug text-callout text-muted-foreground">
        <h2 className="text-body font-label text-foreground">Before you write</h2>
        <ul className="flex list-disc flex-col gap-tight pl-5">
          <li>Include the page URL, match, player or ground when reporting a wrong number.</li>
          <li>We do not take wagers or place bets for anyone; listed prices are market data next to history.</li>
          <li>Account deletion and privacy requests: say so in the subject — see also the <Link className="text-primary underline-offset-2 hover:underline" to="/privacy-policy">privacy policy</Link>.</li>
        </ul>
      </section>
    </div>
  );
}
