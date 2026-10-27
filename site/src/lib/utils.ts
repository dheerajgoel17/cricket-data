import { createCn } from "cn/config";

// One class-merging function for the whole app (shadcn's `ui/*` import it as "cn", see the alias in vite.config.ts and tsconfig.json).
// It knows our named scales from src/index.css, so `text-body` replaces a component's own `text-sm` and `mt-stack` replaces `mt-2`, instead of both staying.
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["display", "title", "body", "callout", "footnote", "caption", "metric", "stat"] }] },
    theme: { spacing: ["hair", "tight", "snug", "stack", "group", "section", "inset", "gutter"] },
  },
});
