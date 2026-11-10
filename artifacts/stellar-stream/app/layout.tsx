import type { ReactNode } from "react";
import "../src/index.css";
import AppProviders from "@/components/app-providers";

export const metadata = {
  title: "MoiFilmi — Good stories travel",
  description: "A thoughtful collection of films, series, and anime.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders
          publishableKey={process.env.CLERK_PUBLISHABLE_KEY ?? ""}
          proxyUrl={process.env.CLERK_PROXY_URL ?? ""}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
