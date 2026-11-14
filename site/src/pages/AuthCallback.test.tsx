import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
      getSession: (...a: unknown[]) => getSession(...a),
    },
  }),
}));

import { AuthCallbackPage } from "./AuthCallback";

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    exchangeCodeForSession.mockReset();
    getSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("prefers ?next= over sessionStorage after a successful code exchange", async () => {
    sessionStorage.setItem("cph-auth-next", "/props");
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc&next=%2Fsaved"]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/saved" element={<p>Saved page</p>} />
          <Route path="/props" element={<p>Props page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Saved page")).toBeVisible());
    expect(exchangeCodeForSession).toHaveBeenCalled();
    expect(sessionStorage.getItem("cph-auth-next")).toBeNull();
  });
});
