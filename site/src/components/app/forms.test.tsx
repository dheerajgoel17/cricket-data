import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DirectorySearch } from "./forms";

it("filters and clears through the shared directory search", () => {
  function Search() {
    const [value, setValue] = useState("");
    return <DirectorySearch label="Search teams" value={value} onChange={setValue} />;
  }

  render(<Search />);
  const search = screen.getByRole("searchbox", { name: "Search teams" });
  fireEvent.change(search, { target: { value: "Sydney" } });
  expect(search).toHaveValue("Sydney");
  fireEvent.click(screen.getByRole("button", { name: "Clear search teams" }));
  expect(search).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Clear search teams" })).not.toBeInTheDocument();
});
