---
name: Next.js preview origins
description: Replit proxy hostname patterns needed for Next.js development HMR.
---

Next.js `allowedDevOrigins` patterns such as `*.replit.dev` may not match Replit's nested `*.picard.replit.dev` preview hostname. Allow the nested hostname pattern when the browser reports a blocked `/_next/hmr` request.

**Why:** The page rendered through the Replit preview, but the narrower origin pattern still blocked hot-module reload requests.

**How to apply:** Check the exact blocked host in Next.js logs and add a matching pattern to `allowedDevOrigins`; keep existing localhost and other required origin patterns.
