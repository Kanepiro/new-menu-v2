
import React, { useEffect, useMemo, useState } from "react";

// ====== Version ======
const FIXED_VERSION_TEXT = "v2.1.129";

// ====== Supabase (optional) ======
let supabaseClient: any = null;
async function initSupabase() {
  try {
    const mod = await import("@supabase/supabase-js");
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rhdamcobcufszomzavuf.supabase.co";
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseClient = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch {
    // package not available; fallback to localStorage
  }
}
initSupabase();

// ====== Types ======
type Row = { label: string; value: number };
type SavePayload = { rows: Row[]; schemaVersion: number };

// ====== Cloud I/O ======
const STORAGE_KEY = "new-menu-v2:data";

async function cloudLoad(): Promise<Partial<SavePayload> | null> {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("menu_app")
      .select("id, payload")
      .eq("id", "singleton")
      .maybeSingle();
    if (error) throw error;
    if (data?.payload) return data.payload as SavePayload;
  }
  const s = localStorage.getItem(STORAGE_KEY);
  return s ? (JSON.parse(s) as SavePayload) : null;
}

async function cloudSave(payload: SavePayload): Promise<void> {
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("menu_app")
      .upsert({ id: "singleton", payload }, { onConflict: "id" });
    if (error) throw error;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ====== Demo data ======
const DEFAULT_ROWS: Row[] = [
  { label: "☕ お茶・食事 1h(1.5)", value: 1.5 },
  { label: "👗 コス📷撮影😔無し(0)", value: 0 },
  { label: "🤗無し😔(0)", value: 0 },
];

export default function App() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [isEditing, setIsEditing] = useState(false);
  const [cloudToast, setCloudToast] = useState<string | null>(null);
  const showCloud = (msg = "☁️") => {
    setCloudToast(msg);
    window.setTimeout(() => setCloudToast(null), 2000);
  };

  // App launch: cloud load then save mirror
  useEffect(() => {
    (async () => {
      try {
        showCloud();
        const obj = await cloudLoad();
        if (obj?.rows && Array.isArray(obj.rows)) setRows(obj.rows as Row[]);
      } catch {}
      try {
        showCloud();
        await cloudSave({ rows, schemaVersion: 1 });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit/hidden: save
  useEffect(() => {
    const handler = async () => {
      try {
        await cloudSave({ rows, schemaVersion: 1 });
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handler();
    });
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [rows]);

  const sum = useMemo(() => rows.reduce((a, r) => a + Number(r.value || 0), 0), [rows]);

  const handleStartEdit = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      showCloud();
      const obj = await cloudLoad();
      if (obj?.rows) setRows(obj.rows as Row[]);
    } catch {}
    showCloud();
    setIsEditing(true);
  };

  const handleBackSave = async () => {
    try {
      showCloud();
      await cloudSave({ rows, schemaVersion: 1 });
    } catch {}
    showCloud();
    setIsEditing(false);
  };

  const addRow = () => setRows((r) => [...r, { label: "新しい項目", value: 0 }]);

  return (
    <div id="capture" data-capture-root className="min-h-dvh w-full overflow-x-hidden bg-green-50 text-green-900 flex flex-col text-[clamp(16px,2.7vw,18px)]">
      {!isEditing ? (
        <header className="sticky top-0 z-30 backdrop-blur-sm">
          <div className="w-full text-center">
            <div className="relative flex items-center justify-center py-1">
              <h1 className="m-0 py-0">新メニュー表</h1>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-80">{FIXED_VERSION_TEXT}</span>
            </div>
            <div className="grid grid-cols-3 gap-6 px-6 pb-2 pt-0">
              <button type="button" className="rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow px-5 py-2" onClick={handleStartEdit}>編集</button>
              <button className="rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow px-5 py-2">PDF</button>
              <button className="rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow px-5 py-2">リセット</button>
            </div>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 backdrop-blur-sm">
          <div className="relative flex items-center justify-center py-0.5">
            <button type="button" onClick={handleBackSave} className="absolute left-0 top-1/2 -translate-y-1/2 h-9 min-h-[36px] px-4 rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base">← 戻る</button>
            <h1 className="m-0 py-0">メニュー編集</h1>
          </div>
        </header>
      )}

      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 pb-24">
        {!isEditing ? (
          <div className="mt-3 space-y-4">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-2xl border border-green-300 bg-white/70 shadow px-4 py-3">
                <div className="truncate pr-4">{row.label}</div>
                <div className="text-3xl tabular-nums">{row.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2 items-center text-green-800">
              <div className="font-semibold">ラベル</div>
              <div className="font-semibold text-right">数値</div>
              <div className="font-semibold text-red-600">削除</div>
            </div>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input className="w-full rounded-xl border border-green-300 bg-white/80 px-3 py-2 shadow-sm"
                    value={r.label}
                    onChange={(e) => setRows((prev) => prev.map((p, idx) => idx === i ? { ...p, label: e.target.value } : p))}
                  />
                  <input type="number" step="0.1" className="w-20 text-right rounded-xl border border-green-300 bg-white/80 px-3 py-2 shadow-sm"
                    value={r.value}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRows((prev) => prev.map((p, idx) => idx === i ? { ...p, value: isNaN(v) ? 0 : v } : p));
                    }}
                  />
                  <button className="h-10 w-10 rounded-xl border border-red-300 text-red-600 bg-white/80 hover:bg-white shadow-sm"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
              <div className="pt-2">
                <button onClick={addRow} className="rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow px-4 py-2">+ 行を追加</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {!isEditing && (
        <footer className="sticky bottom-0 w-full bg-green-100/70 border-t border-green-200">
          <div className="max-w-[900px] mx-auto px-6 py-3 flex items-end justify-between">
            <div className="text-4xl">合計</div>
            <div className="text-[64px] leading-none tabular-nums">{sum.toFixed(1).replace(/\.0$/, "")}</div>
          </div>
        </footer>
      )}

      {cloudToast && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto px-4 py-2 rounded-xl shadow-lg bg-black/80 text-white text-2xl">
            {cloudToast}
          </div>
        </div>
      )}
    </div>
  );
}
