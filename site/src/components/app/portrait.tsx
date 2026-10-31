import { useState } from "react";
import { teamJerseys } from "@cricket/engine/photos.js";
import { useDataMaybe } from "@/lib/data";
import { cn } from "@/lib/utils";
import { PlayerPhoto } from "./badges";

/**
 * A player standing in his team's shirt, laid out the way the source lays out its own player pictures: the face avatar and the shirt are the same width, the shirt
 * is in front and rides up over the bottom third of the avatar (so its collar hides the avatar's cut edge) and only a sliver extends below it. The shirt is the coloured
 * limited-overs kit, or the white one for a Test; a team with no kit gets the plain placeholder shirt, and without any shirt picture it is the face alone.
 * `className` sets the width; the height follows (the two pictures together are about 1.03 times as tall as wide).
 */
export function PlayerPortrait({ idx, team, test, className }: { idx: number; team?: string; test?: boolean; className?: string }) {
  const d = useDataMaybe();
  const [tried, setTried] = useState(0);
  const urls = d?.photos ? (teamJerseys(d.photos, team || "", !!test) as string[]) : [];
  const jersey = urls[tried];
  return (
    <div className={cn("relative shrink-0", jersey ? "aspect-[1/1.03]" : "aspect-[310/300]", className)}>
      <PlayerPhoto idx={idx} contain className="absolute left-0 top-0 aspect-[310/300] w-full" />
      {jersey && <img key={jersey} src={jersey} alt="" aria-hidden loading="lazy" onError={() => setTried((n) => n + 1)} className="absolute inset-x-0 top-[62.7%] z-10 w-full" />}
    </div>
  );
}

/**
 * The round avatar for rows and cards: the same player-in-his-shirt picture, cropped to a circle so the face and the collar and shoulders of the shirt show.
 * `team` and `test` choose the kit as in `PlayerPortrait` (a row knows the side the book files him under and the format of the line).
 */
export function PlayerAvatar({ idx, team, test, className }: { idx: number; team?: string; test?: boolean; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full bg-secondary", className)}>
      <PlayerPortrait idx={idx} team={team} test={test} className="absolute inset-x-0 bottom-0 w-full" />
    </span>
  );
}
