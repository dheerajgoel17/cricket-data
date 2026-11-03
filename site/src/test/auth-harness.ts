import { vi } from "vitest";

/** Controllable auth + in-memory Supabase used by Vitest (see `test-setup.ts`). */
export const authState = {
  user: { id: "test-user", email: "test@example.com" } as { id: string; email: string } | null,
  openSignIn: vi.fn(),
};

type ComboRow = { name: string; query: string; created_at: string };
const items = new Map<string, Set<string>>();
const combos = new Map<string, ComboRow[]>();

export function resetAuthHarness() {
  authState.user = { id: "test-user", email: "test@example.com" };
  authState.openSignIn.mockClear();
  items.clear();
  combos.clear();
}

export function seedSaved(keys: string[], uid = "test-user") {
  items.set(uid, new Set(keys));
}

export function seedCombos(rows: { name: string; query: string }[], uid = "test-user") {
  combos.set(uid, rows.map((r) => ({ ...r, created_at: new Date().toISOString() })));
}

export function savedKeys(uid = "test-user") {
  return [...(items.get(uid) || [])];
}

export function comboRows(uid = "test-user") {
  return [...(combos.get(uid) || [])];
}

export function mockAuthModule() {
  return {
    AuthProvider: ({ children }: { children: unknown }) => children,
    useAuth: () => ({
      user: authState.user,
      session: authState.user ? { user: authState.user } : null,
      loading: false,
      configured: true,
      signInOpen: false,
      openSignIn: authState.openSignIn,
      closeSignIn: vi.fn(),
      requireSignIn: () => {
        if (authState.user) return true;
        authState.openSignIn();
        return false;
      },
      signInWithGoogle: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => { authState.user = null; },
    }),
    useAuthMaybe: () => null,
  };
}

export function mockSupabaseModule() {
  return {
    authConfigured: () => true,
    getSupabase: () => ({
      from(table: string) {
        if (table === "saved_items") {
          return {
            select() {
              return {
                eq(_col: string, uid: string) {
                  return Promise.resolve({ data: [...(items.get(uid) || [])].map((key) => ({ key })), error: null });
                },
              };
            },
            upsert(row: { user_id: string; key: string } | { user_id: string; key: string }[]) {
              const rows = Array.isArray(row) ? row : [row];
              for (const r of rows) {
                if (!items.has(r.user_id)) items.set(r.user_id, new Set());
                items.get(r.user_id)!.add(r.key);
              }
              return Promise.resolve({ error: null });
            },
            delete() {
              return {
                eq(_c: string, uid: string) {
                  return {
                    eq(_c2: string, key: string) {
                      items.get(uid)?.delete(key);
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "saved_combos") {
          return {
            select() {
              return {
                eq(_col: string, uid: string) {
                  return {
                    order() {
                      return Promise.resolve({ data: combos.get(uid) || [], error: null });
                    },
                  };
                },
              };
            },
            upsert(row: { user_id: string; name: string; query: string } | { user_id: string; name: string; query: string }[]) {
              const rows = Array.isArray(row) ? row : [row];
              for (const r of rows) {
                const list = combos.get(r.user_id) || [];
                combos.set(r.user_id, [{ name: r.name, query: r.query, created_at: new Date().toISOString() }, ...list.filter((c) => c.name !== r.name)]);
              }
              return Promise.resolve({ error: null });
            },
            delete() {
              return {
                eq(_c: string, uid: string) {
                  return {
                    eq(_c2: string, name: string) {
                      combos.set(uid, (combos.get(uid) || []).filter((c) => c.name !== name));
                      return Promise.resolve({ error: null });
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    }),
  };
}
