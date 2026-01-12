import React, { useEffect, useMemo, useState } from "react";
import type { Group, MenuItem } from "./menuOptions";
import { MENU_ITEMS_DEFAULT, byGroup, groupsOf } from "./menuOptions";
import { createClient } from "@supabase/supabase-js";


// ---- Cloud Save (Supabase) ----
const SHARED_KEY_B64 = "pAHI97yfr67P9Gui4oPyApIyjnk/rDCqqRKo5VWiMKY="; // 32byte Base64
const CLOUD_OBJECT_PATH = "siCNDuBOVj76ZTKScao8.menu.enc";
// NOTE: Vercel等で環境変数が未設定の場合、createClient が例外を投げて
// 画面が真っ白になることがあるため、未設定時はクラウド機能を無効化して起動を継続する。
let supabase: ReturnType<typeof createClient> | null = null;
try {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0) {
    supabase = createClient(url, key);
  }
} catch (e) {
  console.warn("Supabase init failed; cloud features disabled", e);
  supabase = null;
}
async function getSharedCryptoKey(){const raw=Uint8Array.from(atob(SHARED_KEY_B64),c=>c.charCodeAt(0));return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);}
async function encryptJson(obj){const key=await getSharedCryptoKey();const iv=crypto.getRandomValues(new Uint8Array(12));const data=new TextEncoder().encode(JSON.stringify(obj));const enc=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data);const header=new Uint8Array(16);header.set([0x4E,0x4D,0x32,1]);header.set(iv,4);return new Blob([header,new Uint8Array(enc)],{type:"application/octet-stream"});}
async function decryptBlob(blob){const buf=new Uint8Array(await blob.arrayBuffer());if(!(buf[0]===0x4E&&buf[1]===0x4D&&buf[2]===0x32&&buf[3]===1))throw new Error("invalid header");const iv=buf.slice(4,16);const body=buf.slice(16);const key=await getSharedCryptoKey();const dec=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,body);return JSON.parse(new TextDecoder().decode(new Uint8Array(dec)));}
async function cloudSave(payload){
  if (!supabase) throw new Error("クラウド保存が未設定です（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）");
  const blob=await encryptJson(payload);
  const {error}=await supabase.storage.from("menus").upload(CLOUD_OBJECT_PATH,blob,{upsert:true,contentType:"application/octet-stream"});
  if(error)throw error;
}
async function cloudLoad(){
  if (!supabase) throw new Error("クラウド読込が未設定です（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）");
  const {data,error}=await supabase.storage.from("menus").download(CLOUD_OBJECT_PATH);
  if(error)throw error;
  return await decryptBlob(data);
} 
// ---- Versioning ----
const FIXED_VERSION_TEXT = "v2.1.122";
const VERSION_PREFIX = "2.1"; // major.minor
const STORAGE_VERSION_PATCH = "menu.version.patch";
function loadVersionPatch(): number {
  try {
    const raw = localStorage.getItem(STORAGE_VERSION_PATCH);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 5; // default patch = 005
  } catch { return 1; }
}
function saveVersionPatch(n: number) {
  try { localStorage.setItem(STORAGE_VERSION_PATCH, String(n)); } catch {}
}
function formatVersion(patch: number): string {
  const p = String(patch).padStart(3, "0");
  return `v${VERSION_PREFIX}.${p}`;
}

// --- autoCropWhite: キャンバスの白フチを自動トリム（微小な白も除去） ---
function autoCropWhite(cnv: HTMLCanvasElement, thr = 248): HTMLCanvasElement {
  const w = cnv.width, h = cnv.height;
  if (!w || !h) return cnv;
  const ctx = cnv.getContext("2d"); if (!ctx) return cnv;
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  const isNotWhite = (i: number) => !(d[i] >= thr && d[i+1] >= thr && d[i+2] >= thr && d[i+3] >= 5);
  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  outerTop: for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) if (isNotWhite(row + x*4)) { top = y; break outerTop; }
  }
  outerBottom: for (let y = h - 1; y >= top; y--) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) if (isNotWhite(row + x*4)) { bottom = y; break outerBottom; }
  }
  outerLeft: for (let x = 0; x < w; x++) {
    for (let y = top; y <= bottom; y++) { const i = (y * w + x) * 4; if (isNotWhite(i)) { left = x; break outerLeft; } }
  }
  outerRight: for (let x = w - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) { const i = (y * w + x) * 4; if (isNotWhite(i)) { right = x; break outerRight; } }
  }
  const cw = Math.max(1, right - left + 1), ch = Math.max(1, bottom - top + 1);
  if (cw === w && ch === h) return cnv;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(cnv, left, top, cw, ch, 0, 0, cw, ch);
  return out;
}

// --- Lightweight dropdown (no deps), keyboard & click-outside ---
function Dropdown<T extends number>({
  value,
  options,
  onChange,
  labelFor }: {
  value: T;
  options: { value: T; label: string; right?: string | number }[];
  onChange: (v: T) => void;
  labelFor?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative w-full flex-1 max-w-[calc(100vw-2rem)] md:max-w-none">
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelFor}
        onClick={() => setOpen(v => !v)}
        className="w-full rounded-xl border border-green-300 bg-white/90 text-green-900 px-4 py-3 md:py-2 text-lg md:text-xl text-left shadow-sm"
      >
        <span className="inline-block truncate max-w-[92%] align-middle">{current?.label ?? ""}</span>
        <span className="float-right opacity-70">▾</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
             onClick={() => setOpen(false)} aria-modal="true" role="dialog">
          <div className="w-[min(92vw,520px)] max-h-[80vh] overflow-auto rounded-2xl bg-white shadow-xl p-2"
               onClick={(e)=>e.stopPropagation()}>
            <div className="py-1">
              {options.map((opt) => (
                <button
                  key={String(opt.value)}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={"w-full px-4 py-4 md:py-5 rounded-lg flex items-center justify-between gap-4 " + (opt.value===value ? "bg-emerald-100" : "hover:bg-gray-50")}>
                  <span className="inline-block align-middle whitespace-normal break-words">{opt.label}</span>
                  {typeof opt.right !== "undefined" && (
                    <span className="select-none text-3xl md:text-4xl tabular-nums text-green-600">{String(opt.right)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
type Row = { group: Group; index: number };

const STORAGE_ROWS = "new-menu-v2-rows";
const STORAGE_MENU = "new-menu-v2-menu-items";

const defaultRowsFromItems = (items: MenuItem[]): Row[] => {
  const gs = groupsOf(items);
  return gs.map((g) => ({ group: g, index: 0 }));
};

const loadMenuItems = (): MenuItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_MENU);
    if (raw) {
      const parsed = JSON.parse(raw) as MenuItem[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return [...MENU_ITEMS_DEFAULT];
};

const saveMenuItems = (items: MenuItem[]) => {
  try { localStorage.setItem(STORAGE_MENU, JSON.stringify(items)); } catch {}
};

const loadRows = (items: MenuItem[]): Row[] => {
  const def = defaultRowsFromItems(items);
  try {
    const raw = localStorage.getItem(STORAGE_ROWS);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Row[];
    if (!Array.isArray(parsed) || !parsed.length) return def;
    const gs = groupsOf(items);
    const last = new Map<number, number>();
    for (const r of parsed) last.set(r.group, r.index);
    return gs.map((g) => {
      const list = byGroup(items, g);
      const idx = last.has(g) ? Math.min(Number(last.get(g)), Math.max(0, list.length - 1)) : 0;
      return { group: g as Group, index: idx };
    });
  } catch {}
  return def;
};

const saveRows = (rows: Row[]) => {
  try { localStorage.setItem(STORAGE_ROWS, JSON.stringify(rows)); } catch {}
};

export default function App() {

  // ===== PDF Modal State (inside App) =====
  const [menuOpen, setMenuOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfPwd, setPdfPwd] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  // --- virtual keyboard detection for PDF password modal ---
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [kbPad, setKbPad] = useState(0);

  useEffect(() => {
    if (!pdfOpen) { setKeyboardOpen(false); setKbPad(0); return; }
    const vv: any = (window as any).visualViewport;
    const threshold = 120; // px: treat as keyboard if viewport reduced beyond this
    const update = () => {
      try {
        if (vv) {
          const open = (window.innerHeight - vv.height) > threshold;
          setKeyboardOpen(open);
          setKbPad(open ? Math.max((vv.offsetTop || 0) + 16, Math.round(window.innerHeight * 0.10)) : 0);
        }
      } catch {}
    };
    update();
    if (vv && vv.addEventListener) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (vv && vv.removeEventListener) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      } else {
        window.removeEventListener('resize', update);
      }
    };
  }, [pdfOpen]);

  async function ensurePdfDeps() {
    // @ts-ignore
    if (window.html2canvas && window.pdfMake) return;
    function load(src: string) {
      return new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    await load("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
    await load("https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js");
    await load("https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js");
  }

  const nextTick = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  function applyCaptureStyles() {
    const style = document.createElement('style');
    style.id = '__capture_styles__';
    style.textContent = `
      html, body { -webkit-text-size-adjust: 100%; }
      * { font-synthesis: none; }
      /* neutralize fixed to avoid vertical misalignment */
      .fixed, [data-fixed="true"], footer { position: static !important; }
      [data-capture-root] { min-height: auto !important; padding: 0 !important; }
      main { padding-bottom: 0 !important; flex: none !important; }
      header { padding-top: 0 !important; margin-top: 0 !important; }
      [data-capture-root] .space-y-3 { margin-bottom: 0 !important; }
      [data-capture-root] [data-empty="true"] { display: none !important; }
      [data-capture-root] [data-capture-hide] { display: none !important; }
    `;
    document.head.appendChild(style);
    const ft = document.querySelector('footer') as HTMLElement | null;
    const prevPos = ft ? ft.style.position : null;
    if (ft) ft.style.position = 'static';
    return () => {
      if (ft) ft.style.position = prevPos || '';
      style.remove();
    };
  }

  async function makePasswordPdf(pwd: string) {
    try {
      setPdfBusy(true);
      await ensurePdfDeps();
      await nextTick();
      const root = (document.querySelector("[data-capture-root]") as HTMLElement) || (document.getElementById("root") as HTMLElement) || (document.body as HTMLElement);
      window.scrollTo(0, 0);
      if (!root) { throw new Error("capture root not found"); }
      const cleanup = applyCaptureStyles();

      // ---- capture (high-res) + white-trim ----
      let dataUrl: string;
      let w: number;
      let h: number;
      try {
        const canvas = await (window as any).html2canvas(root, {
          ignoreElements: (el) => el && (el as any).hasAttribute && (el as any).hasAttribute("data-capture-hide"),
          backgroundColor: "#ffffff",
          useCORS: true,
          letterRendering: true,
          foreignObjectRendering: true,
          scale: Math.min(5, Math.max(2, (window.devicePixelRatio || 1) * 2.5)),
          scrollX: 0,
          scrollY: 0
        });
        const cropped = autoCropWhite(canvas, 246);
        const useCanvas = cropped || canvas;
        dataUrl = useCanvas.toDataURL("image/png");
        w = useCanvas.width; h = useCanvas.height;
      } catch (e) {
        console.error('PDF failed', e);
        alert('PDF作成に失敗しました。' + (e && (e as any).message ? '\n' + (e as any).message : '\nもう一度お試しください。'));
        return;
      } finally {
        cleanup();
      }

      // ---- pdfMake doc def ----
      const docDef: any = {
        pageSize: { width: 595, height: Math.max(1, Math.round((h / (w || 1)) * 595)) },
        pageMargins: [0, 0, 0, 0],
        // 画像は紙幅いっぱい。アンチエイリアス由来の白線対策で左上に1pxネガティブ寄せ
        content: [{ image: dataUrl, width: 595, margin: [-1, -1, 0, 0] }],

        // セキュリティ：閲覧は可。印刷/変更/コピー等はすべて禁止
        userPassword: pwd,                 // 閲覧用パスワード（モーダルで入力）
        ownerPassword: "owner-lock-2147", // 所有者パスワード（固定値）
        permissions: {
          printing: "none",
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: false,
          documentAssembly: false
        }
      };

      const pdf = (window as any).pdfMake.createPdf(docDef);

      const fname = `${String(new Date().getMonth()+1).padStart(2,"0")}${String(new Date().getDate()).padStart(2,"0")}ｰ${String(new Date().getHours()).padStart(2,"0")}${String(new Date().getMinutes()).padStart(2,"0")}.pdf`;
      await new Promise<void>((resolve) => pdf.download(fname, resolve));

      pdf.getBlob(async (blob: Blob) => {
        try {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [new File([blob], fname, { type: "application/pdf" })] })) {
            await (navigator as any).share({
              files: [new File([blob], fname, { type: "application/pdf" })],
              title: "パスワード付きPDF",
              text: "作成したPDFを共有します。"
            });
          }
        } catch {}
      });
    } catch (e) {
      console.error('PDF failed', e);
      alert('PDF作成に失敗しました。' + (e && (e as any).message ? '\n' + (e as any).message : '\nもう一度お試しください。'));
    } finally {
      setPdfBusy(false);
    }
  }

  // ---- Version state (display) ----
  const [versionPatch, setVersionPatch] = useState<number>(() => loadVersionPatch());
  const versionText = useMemo(() => formatVersion(versionPatch), [versionPatch]);

  const [menuItems, setMenuItems] = useState<MenuItem[]>(loadMenuItems);
  const [rows, setRows] = useState<Row[]>(() => loadRows(loadMenuItems()));
  const [editing, setEditing] = useState(false);
  // ---- Cloud activity overlay (App) ----
  const [cloudFX, setCloudFX] = useState<"up"|"down"|null>(null);
  useEffect(() => {
    const onFX = (e: any) => {
      const dir = (e && e.detail) === "up" ? "up" : "down";
      setCloudFX(dir);
      setTimeout(() => setCloudFX(null), 2000);
    };
    window.addEventListener("cloud-indicator", onFX as any);
    return () => window.removeEventListener("cloud-indicator", onFX as any);
  }, []);


  useEffect(() => { saveRows(rows); }, [rows]);
  useEffect(() => { saveMenuItems(menuItems); }, [menuItems]);

  // 起動時：クラウド読込→ローカル保存（ベストエフォート）
  useEffect(() => {
    (async () => {
      try {
        window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"down"})); const obj:any = await cloudLoad();
        if (obj) {
          if (Array.isArray(obj.menuItems)) { setMenuItems(obj.menuItems); try { saveMenuItems(obj.menuItems); } catch {} }
          if (Array.isArray(obj.rows)) { setRows(obj.rows); try { saveRows(obj.rows); } catch {} }
        }
      } catch (e) { console.error("startup cloudLoad failed", e); }
    })();
  }, []);


  // アプリ終了/バックグラウンド時に自動保存（ローカルは確実、クラウドはベストエフォート）
  useEffect(() => {
    const saveOnExit = async () => {
      try {
        // ローカル保存は同期的に
        saveMenuItems(menuItems);
        saveRows(rows);
      } catch {}
      try {
        const payload = { menuItems, rows, schemaVersion: 1 } as any;
        window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"up"})); await cloudSave(payload);
      } catch (e) {
        console.error("cloud save (exit) failed", e);
      }
    };
    const onVis = () => { if (document.visibilityState === "hidden") saveOnExit(); };
    const onPageHide = () => { saveOnExit(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [menuItems, rows]);

  const handleCloudSave = async () => {try{const payload={menuItems,rows,schemaVersion:1};window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"up"})); await cloudSave(payload);alert("クラウドに保存しました");}catch(e){console.error(e);alert("保存に失敗しました\n"+(e?.message??""));}};
  const handleCloudLoad = async () => {try{window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"down"})); const obj=await cloudLoad();if(!obj)throw new Error("No Data");if(Array.isArray(obj.menuItems))setMenuItems(obj.menuItems);if(Array.isArray(obj.rows))setRows(obj.rows);showToast("クラウドから読み込みました");}catch(e){console.error(e);alert("読み込みに失敗しました\n"+(e?.message??""));}};


  // ---- Version auto-increment (robust) ----
  const prevSnapRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (prevSnapRef.current === null) {
      try {
        const raw = localStorage.getItem(STORAGE_MENU);
        prevSnapRef.current = raw ?? JSON.stringify(menuItems);
      } catch {
        prevSnapRef.current = JSON.stringify(menuItems);
      }
      return;
    }
    try {
      const snap = JSON.stringify(menuItems);
      if (snap !== prevSnapRef.current) {
        setVersionPatch((p) => {
          const next = p + 1;
          saveVersionPatch(next);
          return next;
        });
        prevSnapRef.current = snap;
      }
    } catch {}
  }, [menuItems]);

  // menuItems が変わったら rows を現在グループに同期（1グループ1行）
  useEffect(() => {
    setRows((prev) => {
      const gs = groupsOf(menuItems);
      const map = new Map<number, number>();
      prev.forEach(r => map.set(r.group, r.index));
      return gs.map((g) => {
        const list = byGroup(menuItems, g);
        const old = map.get(g) ?? 0;
        const safe = list.length ? Math.min(old, list.length - 1) : 0;
        return { group: g, index: safe } as Row;
      });
    });
  }, [menuItems]);

  const total = useMemo(() => {
    return rows.reduce((acc, r) => {
      const list = byGroup(menuItems, r.group);
      const item = list[r.index];
      return acc + (item?.value ?? 0);
    }, 0);
  }, [rows, menuItems]);

  const handleReset = () => {
    const gs = groupsOf(menuItems);
    setRows(gs.map((g) => ({ group: g, index: 0 } as Row)));
  };

  const handleEdit = async () => {
  try {
    window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"down"})); const obj:any = await cloudLoad();
    if (obj) {
      if (Array.isArray(obj.menuItems)) { setMenuItems(obj.menuItems); try { saveMenuItems(obj.menuItems); } catch {} }
      if (Array.isArray(obj.rows)) { setRows(obj.rows); try { saveRows(obj.rows); } catch {} }
    }
  } catch (e) { console.error("edit cloudLoad failed", e); }
  setEditing(true);
};

  if (editing) {
    return (
      <MenuEditor
        items={menuItems}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          setMenuItems(next);
        }}
      />
    );
  }

  return (
    <div id="capture" data-capture-root className="min-h-dvh w-full overflow-x-hidden bg-green-50 text-green-900 flex flex-col text-[clamp(16px,2.7vw,18px)]">
      <header className="w-full max-w-3xl mx-auto pt-6 px-4">
        <div className="relative w-full flex items-baseline justify-center min-h-[48px]">
          <h1 className="absolute left-1/2 -translate-x-1/2 font-bold tracking-wide text-2xl sm:text-3xl md:text-4xl whitespace-nowrap">新メニュー表</h1>
          <span className="absolute right-0 text-sm opacity-70">{FIXED_VERSION_TEXT}</span>
        </div>
        
        <div className="w-full grid grid-cols-3 items-center mt-2">
          <div className="flex justify-start">
            <button
              onClick={handleEdit}
              className="h-9 min-h-[36px] px-4 whitespace-nowrap rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              編集
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => setPdfOpen(true)}
              className="h-9 min-h-[36px] px-5 whitespace-nowrap rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              PDF
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="h-9 min-h-[36px] px-4 whitespace-nowrap rounded-xl border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              リセット
            </button>
          </div>
        </div>

      </header>

      <main className="w-full max-w-3xl mx-auto px-4 mt-4 flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]" data-capture-root="true">
        <div className="space-y-3">
          {rows.map((r, i) => {
            const list = byGroup(menuItems, r.group);
            return (
              <div key={i} className="rounded-xl border border-green-200 bg-white/70 shadow-sm flex items-center justify-between pl-2 pr-4 py-2">
                <Dropdown
                  value={r.index as number}
                  options={list.map((it, idx) => ({ value: idx as number, label: it.label, right: (it?.value ?? 0) }))}
                  onChange={(index) => {
                    setRows(prev => {
                      const next = [...prev];
                      next[i] = { ...next[i], index: Number(index) };
                      return next;
                    });
                  }}
                />
                <div className="ml-2 w-[calc(6rem-2ch-30px)] md:w-[calc(6rem-30px)] text-right text-3xl md:text-4xl tabular-nums">
                  {(list[r.index]?.value ?? 0).toString()}
                </div>
              </div>
            );
          })}
        </div>

        <div data-capture-hide className="h-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"></div>

        
                {/* PDF Password Modal */}
        {pdfOpen && (
          <div className={"fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center " + (keyboardOpen ? "items-start" : "items-center")} style={keyboardOpen ? { paddingTop: kbPad } : undefined}>
            <div className="w-[min(90vw,420px)] rounded-2xl bg-white shadow-xl p-5">
              <div className="text-xl font-semibold text-center mb-2">閲覧用のパスワードを入力して下さい</div>
              <input
                onFocus={() => { setKeyboardOpen(true); }}
                onBlur={() => { /* reset handled by vv listener*/ }}
                type="password"
                value={pdfPwd}
                onChange={(e) => setPdfPwd(e.target.value)}
                className="mt-2 w-full rounded-md border border-green-300 bg-white/90 px-3 py-2 outline-none text-lg"
                placeholder="パスワード（4文字以上）"
                autoFocus
              />
              <div className="text-xs text-gray-500 mt-1">※パスワードは最低4文字です</div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white hover:bg-green-50 shadow-sm text-base"
                  onClick={() => { setPdfOpen(false); setPdfPwd(""); }}
                  disabled={pdfBusy}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={"px-4 py-1 rounded-md border shadow-sm text-base " + (pdfPwd.length >= 4 && !pdfBusy ? "border-green-500 bg-green-600 text-white hover:brightness-110" : "border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed")}
                  onClick={async () => {
                    if (pdfPwd.length < 4 || pdfBusy) return;
                    const pwd = pdfPwd;
                    setPdfOpen(false);
                    setPdfPwd("");
                    await new Promise(r => setTimeout(r, 0));
                    await makePasswordPdf(pwd);
                  }}
                  disabled={pdfPwd.length < 4 || pdfBusy}
                >
                  {pdfBusy ? "作成中..." : "OK"}
                </button>
              </div>
            </div>
          </div>
        )}
      
        {/* Cloud indicator overlay (App) */}
        {cloudFX && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto px-6 py-4 rounded-2xl shadow-lg bg-black/80 text-white text-5xl">
              {cloudFX === "up" ? "☁️↑" : "☁️↓"}
            </div>
          </div>
        )}

      </main>

      <footer className="fixed bottom-0 inset-x-0 z-50 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] border-t border-green-200 bg-green-100/80 backdrop-blur supports-[backdrop-filter]:bg-green-100/70 shadow">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="text-3xl md:text-4xl text-green-700">合計</div>
          <div className="text-6xl md:text-7xl font-extrabold tabular-nums text-green-900">
            {total}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** ===================== メニュー編集画面（フォント拡大） ===================== */
function MenuEditor({
  items,
  onCancel,
  onSave }: {
  items: MenuItem[];
  onCancel: () => void;
  onSave: (items: MenuItem[]) => void;
}) {
  
  // --- ephemeral toast overlay (0.5s) ---
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  // ---- Cloud activity overlay (MenuEditor) ----
  const [cloudFX, setCloudFX] = useState<"up"|"down"|null>(null);
  useEffect(() => {
    const onFX = (e: any) => {
      const dir = (e && e.detail) === "up" ? "up" : "down";
      setCloudFX(dir);
      setTimeout(() => setCloudFX(null), 2000);
    };
    window.addEventListener("cloud-indicator", onFX as any);
    return () => window.removeEventListener("cloud-indicator", onFX as any);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };
const [draft, setDraft] = useState<MenuItem[]>(() => items.map(i => ({ ...i })));

    // 統合保存（ローカル→クラウド）。失敗してもローカルは必ず保存
  const saveBothEdit = async () => {
    try {
      // 先にローカル
      saveMenuItems(draft);
      onSave(draft);
      // クラウドはベストエフォート
      const payload = { menuItems: draft, schemaVersion: 1 };
      try { window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"up"})); await cloudSave(payload); showToast("保存しました(クラウド／ローカル)"); }
      catch (e:any) { console.error(e); showToast("ローカルに保存しました（クラウドは後で再試行）"); }
    } finally {
      // 編集終了
      onCancel();
    }
  };

// Cloud handlers (edit screen)
  const handleCloudSaveEdit = async () => {
    try {
      const payload = { menuItems: draft, schemaVersion: 1 };
      window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"up"})); await cloudSave(payload);
      onSave(draft); // ローカル保存も同時に
      showToast("保存しました(クラウド／ローカル)");
    } catch (e:any) {
      console.error(e);
      alert("保存に失敗しました\n"+(e?.message??""));
    }
  };
  const handleCloudLoadEdit = async () => {
    try {
      window.dispatchEvent(new CustomEvent("cloud-indicator",{detail:"down"})); const obj:any = await cloudLoad();
      if (Array.isArray(obj?.menuItems)) {
        setDraft(obj.menuItems);
        onSave(obj.menuItems); // 親状態も更新し通常画面に即反映（ローカル保存も実施）
      }
      showToast("クラウドから読み込みました");
    } catch (e:any) {
      console.error(e);
      alert("読み込みに失敗しました\n"+(e?.message??""));
    }
  };

  // ローカル保存（編集画面のみ）
  const handleLocalSaveEdit = () => {
    try {
      saveMenuItems(draft);
      onSave(draft);
      showToast("ローカルに一時保存しました");
    } catch (e) {
      console.error(e);
      alert("ローカル保存に失敗しました");
    }
  };
const [tab, setTab] = useState<Group>(() => ( (items[0]?.group ?? 1) as Group ));

  type MapRecord = { [key: number]: Group };

  const normalizeGroups = (arr: MenuItem[], preferTab?: Group) => {
    const sorted = Array.from(new Set(arr.map(a => a.group))).sort((a,b)=>a-b);
    const map: MapRecord = {};
    let next = 1 as Group;
    for (const g of sorted) {
      if (next > 6) break;
      map[g] = next as Group;
      next = (next + 1) as Group;
    }
    const remapped = arr.map(a => ({ ...a, group: map[a.group] ?? 6 as Group }));
    const newGroups = Array.from(new Set(remapped.map(a => a.group))).sort((a,b)=>a-b) as Group[];
    const newTab = preferTab && map[preferTab] ? map[preferTab] : (newGroups[0] ?? 1) as Group;
    return { remapped, newTab };
  };

  const currentGroups = () => Array.from(new Set(draft.map(d => d.group))).sort((a,b)=>a-b) as Group[];
  const groupList = (g: Group) => draft.filter(d => d.group === g);
  const setGroupList = (g: Group, list: MenuItem[]) => {
    const others = draft.filter(d => d.group !== g);
    setDraft([...others, ...list.map(v => ({ ...v, group: g }))]);
  };

  const addRow = (g: Group) => {
    const list = groupList(g);
    setGroupList(g, [...list, { group: g, label: "", value: 0 }]);
  };

  const removeRow = (g: Group, idx: number) => {
    const list = groupList(g).slice();
    list.splice(idx, 1);
    setGroupList(g, list);
  };

  const updateRow = (g: Group, idx: number, patch: Partial<MenuItem>) => {
    const list = groupList(g).slice();
    list[idx] = { ...list[idx], ...patch };
    setGroupList(g, list);
  };

  const resetToDefault = () => {
    const next = MENU_ITEMS_DEFAULT.map(i => ({ ...i }));
    setDraft(next);
    onSave(next); // 自動保存
    setTab(1 as Group);
  };

  const addGroup = () => {
    const present = new Set(currentGroups());
    for (const g of [1,2,3,4,5,6] as Group[]) {
      if (!present.has(g)) {
        setDraft(prev => [...prev, { group: g, label: "", value: 0 }]);
        setTab(g);
        return;
      }
    }
  };

  const removeGroup = () => {
    const groups = currentGroups();
    if (groups.length <= 1) return;
    const g = tab;
    const afterDelete = draft.filter(d => d.group !== g);
    const { remapped, newTab } = normalizeGroups(afterDelete, (g + 1) as Group);
    setDraft(remapped);
    setTab(newTab);
    onSave(remapped); // 保存（閉じない）
  };

  const totalCount = draft.length;
  const groups = currentGroups();

  return (
    <div id="capture" data-capture-root className="min-h-dvh w-full overflow-x-hidden bg-green-50 text-green-900 flex flex-col text-[clamp(16px,2.7vw,18px)]">
      <header className="w-full max-w-3xl mx-auto pt-4 px-4">
  <div className="w-full flex justify-center">
    <div className="inline-flex items-center gap-3">
      <button onClick={saveBothEdit}  className="h-9 min-h-[36px] px-4 whitespace-nowrap rounded-lg border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg">←保存</button>
      <h1 className="font-bold tracking-wide text-3xl md:text-4xl">メニュー編集</h1>
    </div>
  </div>

{cloudFX && (
  <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
    <div className="pointer-events-auto px-6 py-4 rounded-2xl shadow-lg bg-black/80 text-white text-5xl">
      {cloudFX === "up" ? "☁️↑" : "☁️↓"}
    </div>
  </div>
)}

{toastMsg && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto px-4 py-3 rounded-xl shadow-lg bg-black/80 text-white text-sm md:text-base">
              {toastMsg}
            </div>
          </div>
        )}
</header>

      <main className="w-full max-w-3xl mx-auto px-4 mt-4 flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]" data-capture-root="true">
        <div className="w-full flex justify-center">
          <div className={"mb-2 rounded-xl border border-green-300 bg-white/80 overflow-hidden " + (currentGroups().length >= 4 ? "grid grid-cols-3" : "inline-flex")}>
            {currentGroups().map((g, idx) => (
              <button
                key={g}
                onClick={() => setTab(g)}
                className={
                  "px-4 py-2 text-base md:text-lg font-medium " +
                  (currentGroups().length >= 4
                    ? ("border-r border-b last:border-r-0 " + (idx < 3 ? "border-b " : ""))
                    : "border-r last:border-r-0 ") +
                  (tab === g ? "bg-emerald-600 text-white" : "hover:bg-white")
                }
              >
                グループ {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const groups = currentGroups();
              if (groups.length <= 1) return;
              const g = tab;
              const afterDelete = draft.filter(d => d.group !== g);
              const sorted = Array.from(new Set(afterDelete.map(a => a.group))).sort((a,b)=>a-b);
              const map: any = {}; let next = 1;
              for (const gg of sorted) { if (next > 6) break; map[gg] = next; next++; }
              const remapped = afterDelete.map(a => ({ ...a, group: (map[a.group] ?? 6) as Group }));
              const newGroups = Array.from(new Set(remapped.map(a => a.group))).sort((a,b)=>a-b) as Group[];
              setDraft(remapped);
              setTab((newGroups[0] ?? 1) as Group);
              onSave(remapped);
            }}
            className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-600 shadow-sm text-base md:text-lg"
          >
            グループの削除
          </button>
          <button
            onClick={() => {
              const present = new Set(currentGroups());
              for (const g of [1,2,3,4,5,6] as Group[]) {
                if (!present.has(g)) {
                  setDraft(prev => [...prev, { group: g, label: "", value: 0 }]);
                  setTab(g);
                  return;
                }
              }
            }}
            className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white hover:bg-green-50 shadow-sm disabled:opacity-50 text-base md:text-lg"
            disabled={currentGroups().length >= 6}
          >
            グループの追加
          </button>
        </div>

        <div className="rounded-xl border border-green-200 bg-white/70 shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.5ch,6.5ch)_32px] md:grid-cols-[minmax(0,1fr)_minmax(6ch,8ch)_48px] gap-2 p-3 items-center text-sm md:text-base font-medium text-green-700">
            <div>ラベル</div><div className="text-left pl-1">数値</div><div className="text-center md:text-right text-red-600">削除</div>
          </div>
          <div className="divide-y divide-green-100">
            {draft.filter(d => d.group === tab).map((row, idx) => (
              <div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(4.5ch,6.5ch)_32px] md:grid-cols-[minmax(0,1fr)_minmax(6ch,8ch)_48px] gap-2 p-3 items-center">
                <input
                  className="min-w-0 rounded-md border border-green-200 bg-white/90 px-2 py-2 outline-none text-lg md:text-xl"
                  value={row.label}
                  onChange={(e) => {
                    const list = draft.filter(d => d.group === tab).slice();
                    list[idx] = { ...list[idx], label: e.target.value };
                    const others = draft.filter(d => d.group !== tab);
                    const merged = [...others, ...list.map(v => ({ ...v, group: tab }))];
                    setDraft(merged);
                  }}
                  placeholder="メニュー名"
                />
                <input
                  className="w-[4.5ch] rounded-md border border-green-200 bg-white/90 px-2 py-2 text-right outline-none text-lg md:text-xl"
                  inputMode="decimal"
                  value={String(row.value ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const norm = raw.replace(/[．。]/g, ".");
                    if (norm === "" || norm === "-" || norm === "." || /^\d+\.$/.test(norm)) {
                      const list = draft.filter(d => d.group === tab).slice();
                      list[idx] = { ...list[idx], value: norm as any };
                      const others = draft.filter(d => d.group !== tab);
                      const merged = [...others, ...list.map(v => ({ ...v, group: tab }))];
                      setDraft(merged);
                      return;
                    }
                    const f = Number.parseFloat(norm);
                    const list = draft.filter(d => d.group === tab).slice();
                    list[idx] = { ...list[idx], value: Number.isFinite(f) ? f : 0 };
                    const others = draft.filter(d => d.group !== tab);
                    const merged = [...others, ...list.map(v => ({ ...v, group: tab }))];
                    setDraft(merged);
                  }}
                  placeholder="0"
                />
                <button
                  onClick={() => {
                    const list = draft.filter(d => d.group === tab).slice();
                    list.splice(idx, 1);
                    const others = draft.filter(d => d.group !== tab);
                    const merged = [...others, ...list.map(v => ({ ...v, group: tab }))];
                    setDraft(merged);
                  }}
                  className="px-2 py-2 w-8 text-center rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-600 text-base md:text-lg"
                  aria-label="削除">☓</button>
              </div>
            ))}
            <div className="p-3 flex justify-end">
              <button
                onClick={() => {
                  const list = draft.filter(d => d.group === tab);
                  const merged = [...draft, { group: tab, label: "", value: 0 }];
                  setDraft(merged);
                }}
                className="px-4 py-2 rounded-md border border-green-300 bg-white hover:bg-green-50 text-base md:text-lg"
              >
                + 行を追加
              </button>
            </div>
          </div>
        </div>

        <div data-capture-hide className="h-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"></div>
      
        {/* Cloud indicator overlay (App) */}
        {cloudFX && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto px-6 py-4 rounded-2xl shadow-lg bg-black/80 text-white text-5xl">
              {cloudFX === "up" ? "☁️↑" : "☁️↓"}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}