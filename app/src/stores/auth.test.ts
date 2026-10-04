import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("../services/supabase", () => ({
  configured: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: (...args: unknown[]) => signOut(...args)
    }
  }
}));

import { useAuthStore } from "./auth";

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getSession.mockReset().mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset().mockResolvedValue({});
  });

  it("init() recupera la sessione esistente e smette di caricare", async () => {
    const session = { access_token: "t" };
    getSession.mockResolvedValue({ data: { session } });
    const store = useAuthStore();
    await store.init();
    expect(store.session).toEqual(session);
    expect(store.loading).toBe(false);
    expect(store.isAuthenticated).toBe(true);
  });

  it("init() senza sessione lascia isAuthenticated false", async () => {
    const store = useAuthStore();
    await store.init();
    expect(store.isAuthenticated).toBe(false);
    expect(store.loading).toBe(false);
  });

  it("signIn() con credenziali valide imposta la sessione", async () => {
    const session = { access_token: "t" };
    signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    const store = useAuthStore();
    const result = await store.signIn("coach@example.com", "password");
    expect(result.ok).toBe(true);
    expect(store.session).toEqual(session);
  });

  it("signIn() con credenziali non valide restituisce un messaggio generico", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid login credentials" } });
    const store = useAuthStore();
    const result = await store.signIn("coach@example.com", "wrong");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Credenziali non valide.");
    expect(store.isAuthenticated).toBe(false);
  });

  it("signOut() azzera la sessione", async () => {
    const store = useAuthStore();
    store.session = { access_token: "t" } as never;
    await store.signOut();
    expect(store.session).toBeNull();
    expect(signOut).toHaveBeenCalled();
  });
});
