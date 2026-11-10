"use client";

import { SignIn, SignUp } from "@clerk/react";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

const appearance = {
  theme: "simple" as const,
  variables: {
    colorPrimary: "#dfc57f",
    colorForeground: "#f2f1ed",
    colorMutedForeground: "#a1a5af",
    colorDanger: "#e37979",
    colorBackground: "#151821",
    colorInput: "#202530",
    colorInputForeground: "#f2f1ed",
    colorNeutral: "#e0dccf",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "14px",
  },
  elements: {
    rootBox: "auth-clerk-root",
    cardBox: "auth-clerk-card-box",
    card: "auth-clerk-card",
    footer: "auth-clerk-footer",
    headerTitle: "auth-clerk-heading",
    headerSubtitle: "auth-clerk-subheading",
    socialButtonsBlockButton: "auth-clerk-social-button",
    socialButtonsBlockButtonText: "auth-clerk-social-text",
    formFieldLabel: "auth-clerk-label",
    formFieldInput: "auth-clerk-input",
    formButtonPrimary: "auth-clerk-primary",
    footerActionText: "auth-clerk-footer-text",
    footerActionLink: "auth-clerk-link",
    dividerLine: "auth-clerk-divider",
    dividerText: "auth-clerk-divider-text",
    alert: "auth-clerk-alert",
    alertText: "auth-clerk-alert-text",
  },
};

export default function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const logoImageUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? "/logo.svg"
        : `${window.location.origin}/logo.svg`,
    [],
  );
  const customizedAppearance = useMemo(
    () => ({
      ...appearance,
      options: {
        logoPlacement: "inside" as const,
        logoLinkUrl: "/",
        logoImageUrl,
      },
    }),
    [logoImageUrl],
  );

  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true" />
      <Link className="auth-brand" href="/" data-testid="link-auth-home">
        <span className="brand-mark"><Sparkles size={16} /></span>
        <span>MOIFILMI</span>
      </Link>
      <section className="auth-panel">
        <Link href="/" className="auth-back-link" data-testid="link-auth-back">
          <ArrowLeft size={15} /> Back to MoiFilmi
        </Link>
        {mode === "sign-in" ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
            appearance={customizedAppearance}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
            appearance={customizedAppearance}
          />
        )}
      </section>
      <p className="auth-note">A place for stories worth staying with.</p>
    </main>
  );
}
