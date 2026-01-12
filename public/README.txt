
PWA Icon Set
============
Base design: A_flat_design_digital_vector_icon_features_a_squar.png

Included:
- Android/Chromium icons: 48,72,96,144,192,256,384,512
- Extra sizes: 128,144,152,167,180,192,256,384,512,1024
- Maskable icons: 192, 512  (with ~18% safe padding)
- Apple touch icons: 120,152,167,180,1024
- manifest/manifest-snippet.json  → merge into your manifest.webmanifest

Suggested manifest usage:
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/maskable-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
Place:
  - /public/icons/*.png
  - /public/apple/*.png
  - Add appropriate <link rel="apple-touch-icon" ...> tags for iOS if needed.
