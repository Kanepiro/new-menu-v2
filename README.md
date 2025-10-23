# 新メニュー表 — 0からスターター（Vite + React + TS + Tailwind + PWA）

## 使い方
```bash
npm i
npm run dev         # http://localhost:5173
npm run build
npm run preview     # http://localhost:4173
```

- タイトルは中央、リセットは次の行の右端（あなたの最初の指示どおり）
- PWA: `vite-plugin-pwa` を同梱。`preview` で SW が動きます
- アイコンはプレースホルダーなので後で差し替えてください（`public/icons/`）

## ここから足していく
- 既存メニューのUIを、この `src/App.tsx` の `<main>` 内に移植していけばOK
- 以後の変更は **あなたの指示以外は一切加えません（最小差分）**
