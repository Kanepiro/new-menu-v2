// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const APP_VERSION = "v2.1.090";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const BUCKET = "menus";
const OBJECT_PATH = "SC1C0WBU0yJ7G1TZKSa08.menu.enc";

const LOCAL_KEY = "menuItems";

type Group = 1 | 2 | 3 | 4 | 5;
type Item = { id: string; label: string; value: number; group: Group };

const supabase = createClient(supabaseUrl, supabaseAnon);
const uid = () => Math.random().toString(36).slice(2, 10);

const defaultItems: Item[] = [
  { id: uid(), label: "🏨 お泊り", value: 40, group: 1 },
  { id: uid(), label: "👗 コス 📷 撮影なし", value: 0, group: 2 },
  { id: uid(), label: "🥰 なし", value: 0, group: 3 },
];

function sanitizeForSave(arr: Item[]) {
  return arr.map(({ id, label, value, group }) => ({ id, label, value, group }));
}

async function cloudSave(items: Item[]) {
  const json = JSON.stringify(sanitizeForSave(items));
  const blob = new Blob([json], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, blob, { upsert: true, contentType: "application/json" });
  if (error) throw error;
}

async function cloudLoad(): Promise<Item[]> {
  const { data, error } = await supabase.storage.from(BUCKET).download(OBJECT_PATH);
  if (error) throw error;
  const text = await data.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("不正なデータ形式です");
  return parsed as Item[];
}

type Mode = "view" | "edit";

export default function App() {
  const [mode, setMode] = useState<Mode>("view");
  const [items, setItems] = useState<Item[]>(() => {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Item[];
      } catch {}
    }
    return defaultItems;
  });

  const rows = useMemo(() => items, [items]);
  const total = useMemo(() => rows.reduce((a, r) => a + Number(r.value || 0), 0), [rows]);

  const onCancel = () => setMode("view");

  const onSaveLocal = () => {
    try {
      const payload = sanitizeForSave(items);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
      alert("ローカルに保存しました");
    } catch (e:any) {
      console.error(e);
      alert("ローカル保存に失敗しました\n" + (e?.message ?? ""));
    }
  };

  const onSaveCloud = async () => {
    try {
      const payload = sanitizeForSave(items);
      await cloudSave(payload);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
      alert("クラウドに保存しました");
    } catch (e:any) {
      console.error(e);
      alert("保存に失敗しました\n" + (e?.message ?? ""));
    }
  };

  const onLoadCloud = async () => {
    try {
      const data = await cloudLoad();
      setItems(data);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
      alert("クラウドから読み込みました");
    } catch (e:any) {
      console.error(e);
      alert("読み込みに失敗しました\n" + (e?.message ?? ""));
    }
  };

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = (group: Group) =>
    setItems((prev) => [...prev, { id: uid(), label: "", value: 0, group }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const [tab, setTab] = useState<Group>(1);
  useEffect(() => {
    const g = (items[0]?.group ?? 1) as Group;
    setTab(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "edit") {
    const tabItems = items.filter((it) => it.group === tab);
    return (
      <div className="min-h-screen bg-green-50 text-green-900 flex flex-col">
        <header className="w-full max-w-3xl mx-auto px-4 mt-3">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-green-900">メニュー編集</h1>
            <div className="text-green-800 text-sm">{APP_VERSION}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={onCancel}
              className="h-9 min-h-[36px] px-4 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base"
            >
              ← 戻る
            </button>
            <button
              onClick={onSaveLocal}
              className="h-9 min-h-[36px] px-4 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base"
            >
              保存📁
            </button>
            <button
              onClick={onSaveCloud}
              className="h-9 min-h-[36px] px-4 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base"
            >
              保存☁️
            </button>
            <button
              onClick={onLoadCloud}
              className="h-9 min-h-[36px] px-4 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base"
            >
              読込☁️
            </button>
          </div>
        </header>

        <div className="w-full max-w-3xl mx-auto px-4 mt-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((g) => (
              <button
                key={g}
                onClick={() => setTab(g as Group)}
                className={`px-4 py-2 rounded-full border ${
                  tab === g
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-green-800 border-green-300"
                }`}
              >
                グループ {g}
              </button>
            ))}
            <button
              onClick={() => addItem(tab)}
              className="ml-auto px-4 py-2 rounded-md border border-green-300 bg-white hover:bg-green-50"
            >
              行を追加
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {tabItems.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[1fr_110px_60px] gap-3 items-center bg-white/70 border border-green-200 rounded-xl p-3"
              >
                <input
                  value={it.label}
                  onChange={(e) => updateItem(it.id, { label: e.target.value })}
                  placeholder="ラベル"
                  className="h-10 px-3 rounded-md border border-green-300 bg-white"
                />
                <input
                  value={it.value}
                  onChange={(e) => updateItem(it.id, { value: Number(e.target.value || 0) })}
                  type="number"
                  step="1"
                  className="h-10 px-3 rounded-md border border-green-300 bg-white text-right"
                />
                <button
                  onClick={() => removeItem(it.id)}
                  className="h-10 rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            {tabItems.length === 0 && (
              <div className="text-center text-green-700 py-6">このグループには項目がありません</div>
            )}
          </div>
        </div>

        <div className="h-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 text-green-900 flex flex-col">
      <header className="w-full max-w-3xl mx-auto px-4 mt-6">
        <div className="flex items-start justify-between">
          <h1 className="text-4xl font-extrabold tracking-wide text-green-900">新メニュー表</h1>
          <div className="text-green-800 mt-1 select-none">{APP_VERSION}</div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <button
            onClick={() => setMode("edit")}
            className="h-11 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-lg"
          >
            編集
          </button>
          <button
            onClick={() => window.alert("PDF 機能は既存の実装を使用してください")}
            className="h-11 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-lg"
          >
            PDF
          </button>
          <button
            onClick={() => {
              setItems(defaultItems);
              localStorage.setItem(LOCAL_KEY, JSON.stringify(defaultItems));
            }}
            className="h-11 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-lg"
          >
            リセット
          </button>
        </div>
      </header>

      <main
        className="w-full max-w-3xl mx-auto px-4 mt-4 flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]"
        data-capture-root="true"
      >
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 bg-white/70 border border-green-200 rounded-2xl p-4"
            >
              <div className="text-xl">{r.label}</div>
              <div className="text-4xl font-bold tabular-nums">{r.value}</div>
            </div>
          ))}
        </div>
      </main>

      <footer
        data-capture-hide
        className="fixed bottom-0 inset-x-0 bg-green-100/90 border-t border-green-200"
      >
        <div className="max-w-3xl mx-auto px-6 h-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] flex items-end justify-between pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <div className="text-5xl font-bold">合計</div>
          <div className="text-6xl font-extrabold tabular-nums">{total}</div>
        </div>
      </footer>
    </div>
  );
}
