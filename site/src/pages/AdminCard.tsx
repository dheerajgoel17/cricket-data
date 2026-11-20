/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { parseCardLink, posterPath } from "@cricket/engine/card-link.js";
import { downloadBlob } from "@/lib/share";
import { setTitle } from "@/lib/title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Internal share-card maker: paste a player-prop or Match Fancy link, get the vertical (4:5) poster. noindex (under /admin/). */
export function AdminCardPage() {
  setTitle("Card maker");
  const [text, setText] = useState("");
  const link: any = useMemo(() => parseCardLink(text), [text]);
  const src = useMemo(() => posterPath(link), [link]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    setBlob(null); setBlobUrl(null);
    if (!src) { setState("idle"); return; }
    const ac = new AbortController();
    setState("loading");
    fetch(src, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok || !/^image\//.test(r.headers.get("content-type") || "")) throw new Error(String(r.status));
        const b = await r.blob();
        setBlob(b); setBlobUrl(URL.createObjectURL(b)); setState("ready");
      })
      .catch((e) => { if (e?.name !== "AbortError") setState("error"); });
    return () => ac.abort();
  }, [src]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const kind = link?.kind === "fancy" ? "Fancy market" : link?.kind === "player" ? "Player prop" : null;
  const name = link?.kind === "fancy" ? `fancy-${link.f}-${link.fm}.png` : link?.kind === "player" ? `player-${link.p ?? link.pid}-${link.stat ?? "card"}-${link.line ?? ""}.png` : "card.png";

  return (
    <div className="flex flex-col gap-section">
      <header>
        <h1 className="text-title font-emphasis tracking-tight">Card maker</h1>
        <p className="text-footnote text-muted-foreground">Paste a player prop link (/player/…?stat=&line=) or a Match Fancy link (/fixture/…/fancy?fm=). The type is read from the link.</p>
      </header>
      <div className="flex flex-col gap-snug sm:flex-row sm:items-center">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/player/123?stat=runs&line=24.5" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="h-control rounded-full" />
        {kind && <span className="w-fit shrink-0 rounded-full bg-secondary px-snug py-tight text-footnote font-label">{kind}</span>}
      </div>
      {text.trim() && !link && <p className="text-callout text-muted-foreground">That is not a player or Match Fancy link. A fancy link needs <code>?fm=</code>.</p>}
      {state === "loading" && <p className="text-callout text-muted-foreground">Drawing…</p>}
      {state === "error" && <p className="text-callout text-muted-foreground">No card for that link: the match or its books are not in the data right now.</p>}
      {state === "ready" && blobUrl && blob && (
        <div className="flex flex-col items-start gap-snug">
          <img src={blobUrl} alt="Share card preview" className="w-full max-w-[420px] rounded-2xl border border-border" width={1080} height={1350} />
          <div className="flex gap-tight">
            <Button type="button" className="h-control rounded-full" onClick={() => { downloadBlob(blob, name); toast("Image saved"); }}>Download PNG</Button>
            <Button type="button" variant="secondary" className="h-control rounded-full" onClick={async () => { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("Copied"); } catch { toast("Copy not available here"); } }}>Copy image</Button>
          </div>
        </div>
      )}
    </div>
  );
}
