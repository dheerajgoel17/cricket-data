import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TabsContent } from "@/components/ui/tabs";
import { PillTabs } from "./pill-tabs";

function Demo() {
  const [v, setV] = useState("a");
  return <PillTabs layoutId="t" tabs={[["a", "Alpha"], ["b", "Beta"]]} value={v} onChange={setV}><TabsContent value="a">first panel</TabsContent><TabsContent value="b">second panel</TabsContent></PillTabs>;
}

describe("PillTabs (shadcn Tabs + Motion indicator)", () => {
  it("switches panels when a pill is chosen", async () => {
    render(<Demo />);
    expect(screen.getByText("first panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByText("second panel")).toBeInTheDocument();
    expect(screen.queryByText("first panel")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
  });
});
