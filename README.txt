What's inside
-------------
1) vercel.json  -> single valid JSON object, adds SPA rewrite and sets build/output.
2) src/main.tsx -> uses `virtual:pwa-register` from vite-plugin-pwa (no manual /sw.js).

How to apply
------------
- Replace your project's root vercel.json with this one.
- Replace your src/main.tsx with this one.
- Remove public/sw.js to avoid conflicts (vite-plugin-pwa will generate the SW).
- Ensure public/manifest.webmanifest exists with icons (already present in your project).

Vercel dashboard
----------------
- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
- Install Command: (default is fine, lockfile present) or set to npm i
