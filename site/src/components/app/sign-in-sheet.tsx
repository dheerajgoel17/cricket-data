import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/** Free sign-in dialog — brand, Google, then a single email form. Opens when starring or opening Saved while logged out. */
export function SignInSheet() {
  const { signInOpen, closeSignIn, configured, signInWithGoogle, signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) { toast("Use a valid email and a password of at least 6 characters."); return; }
    setBusy(true);
    const r = mode === "in" ? await signInWithPassword(email, password) : await signUp(email, password);
    setBusy(false);
    if (r.error) toast(r.error);
    else toast(mode === "in" ? "Signed in. Saved syncs to this account." : "Account created. Check email if confirmation is required.");
  };

  const google = async () => {
    setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) toast(r.error);
  };

  return (
    <Dialog open={signInOpen} onOpenChange={(o) => { if (!o) closeSignIn(); }}>
      <DialogContent
        showCloseButton
        className={cn(
          "gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[22.5rem]",
          "[&_[data-slot=dialog-close]]:right-3 [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-secondary/80 [&_[data-slot=dialog-close]]:p-2 [&_[data-slot=dialog-close]]:opacity-100",
        )}
      >
        <div className="rounded-2xl bg-card ring-1 ring-hairline">
          <div className="flex flex-col items-center gap-snug px-group pb-snug pt-group text-center">
            <BrandMark className="size-12" />
            <div className="grid gap-hair">
              <DialogTitle className="text-title font-emphasis tracking-tight text-foreground">
                {mode === "in" ? "Sign in to save" : "Create a free account"}
              </DialogTitle>
              <DialogDescription className="text-balance text-callout text-muted-foreground">
                Watchlist, players and filters sync to your account.
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-col gap-stack px-group pb-group">
            {!configured ? (
              <p className="rounded-xl bg-secondary px-inset py-snug text-left text-callout text-muted-foreground">
                Sign-in is currently unavailable. You can still browse fixtures and stats.
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={google}
                  className="h-11 w-full gap-snug rounded-full text-body font-label"
                >
                  <GoogleGlyph className="size-5" />
                  Continue with Google
                </Button>

                <div className="flex items-center gap-snug" aria-hidden>
                  <span className="h-px flex-1 bg-hairline" />
                  <span className="text-caption text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-hairline" />
                </div>

                <form className="grid gap-snug" onSubmit={submit}>
                  <div className="grid gap-tight text-left">
                    <Label htmlFor="cph-email" className="text-footnote text-muted-foreground">Email</Label>
                    <Input
                      id="cph-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl border-hairline bg-background px-inset"
                      required
                    />
                  </div>
                  <div className="grid gap-tight text-left">
                    <Label htmlFor="cph-password" className="text-footnote text-muted-foreground">Password</Label>
                    <Input
                      id="cph-password"
                      type="password"
                      autoComplete={mode === "in" ? "current-password" : "new-password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      className="h-11 rounded-xl border-hairline bg-background px-inset"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="mt-tight h-11 w-full rounded-full text-body font-label">
                    {mode === "in" ? "Sign in with email" : "Create account"}
                  </Button>
                </form>

                <p className="text-center text-callout text-muted-foreground">
                  {mode === "in" ? (
                    <>No account?{" "}
                      <button type="button" className="font-label text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setMode("up")}>
                        Create one free
                      </button>
                    </>
                  ) : (
                    <>Already have an account?{" "}
                      <button type="button" className="font-label text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setMode("in")}>
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
