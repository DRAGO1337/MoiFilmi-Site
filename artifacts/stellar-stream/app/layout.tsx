import type { ReactNode } from "react";
import "../src/index.css";

export const metadata = {
  title: "MoiFilmi — Good stories travel",
  description: "A thoughtful collection of films, series, and anime.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
