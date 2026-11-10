"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAccountQueryKey,
  useGetAccount,
  useUpdateAccount,
} from "@workspace/api-client-react";
import { ArrowLeft, Check, LoaderCircle, LogOut, ShieldCheck, UserRound } from "lucide-react";

export default function AccountPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const account = useGetAccount({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getGetAccountQueryKey(),
    },
  });
  const updateAccount = useUpdateAccount();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (account.data) setDisplayName(account.data.displayName);
  }, [account.data]);

  if (!isLoaded || (isSignedIn && account.isLoading)) {
    return (
      <main className="account-shell">
        <div className="account-loading"><LoaderCircle className="animate-spin" size={18} /> Loading your account…</div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="account-shell">
        <Link href="/" className="account-back"><ArrowLeft size={15} /> Back to MoiFilmi</Link>
        <section className="account-empty">
          <UserRound size={26} />
          <h1>Your account</h1>
          <p>Sign in to manage your profile, favorites, and viewing history.</p>
          <Link href="/sign-in" className="account-primary">Sign in</Link>
        </section>
      </main>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    updateAccount.mutate(
      { data: { displayName: displayName.trim() } },
      {
        onSuccess: () => {
          setMessage("Profile saved.");
          void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
        },
        onError: () => setMessage("Your profile could not be saved. Try again."),
      },
    );
  }

  const initials = (account.data?.displayName || user?.firstName || "M")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <main className="account-shell">
      <Link href="/" className="account-back"><ArrowLeft size={15} /> Back to MoiFilmi</Link>
      <header className="account-heading">
        <p className="section-kicker">YOUR MOIFILMI ACCOUNT</p>
        <h1>Account & profile</h1>
        <p>Manage your profile and the stories you keep close.</p>
      </header>

      {account.isError ? (
        <div className="account-error" role="alert">
          We could not load your profile. Please refresh and try again.
        </div>
      ) : (
        <div className="account-layout">
          <section className="account-card profile-card">
            <div className="profile-identity">
              {account.data?.avatarUrl ? (
                <img src={account.data.avatarUrl} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar profile-initials">{initials}</div>
              )}
              <div>
                <h2>{account.data?.displayName || "Your profile"}</h2>
                <p>{account.data?.email}</p>
              </div>
            </div>
            <form onSubmit={submit} className="account-form">
              <label htmlFor="account-display-name">Display name</label>
              <input
                id="account-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                required
                data-testid="input-display-name"
              />
              {message && (
                <p
                  className={message === "Profile saved." ? "account-success" : "account-error"}
                  role="status"
                  data-testid="status-profile-save"
                >
                  {message === "Profile saved." && <Check size={14} />} {message}
                </p>
              )}
              <button
                type="submit"
                className="account-primary"
                disabled={updateAccount.isPending || !displayName.trim()}
                data-testid="button-save-profile"
              >
                {updateAccount.isPending ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          <section className="account-card account-security">
            <div className="account-card-icon"><ShieldCheck size={18} /></div>
            <div>
              <h2>Account security</h2>
              <p>Password and session settings are managed securely by your sign-in provider.</p>
              {account.data?.emailVerified && <span className="verified-label"><Check size={13} /> Email verified</span>}
            </div>
            <button
              className="account-secondary"
              onClick={() => void signOut({ redirectUrl: "/" })}
              data-testid="button-sign-out"
            >
              <LogOut size={15} /> Sign out
            </button>
          </section>

          <nav className="account-links" aria-label="Personal library">
            <Link href="/my-list" data-testid="link-account-watchlist">My watchlist</Link>
            <Link href="/continue" data-testid="link-account-progress">Continue watching</Link>
            {account.data?.role === "admin" && <Link href="/admin" data-testid="link-account-admin">Admin dashboard</Link>}
          </nav>
        </div>
      )}
    </main>
  );
}
