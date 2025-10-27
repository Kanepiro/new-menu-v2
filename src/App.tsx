import React, { useEffect, useMemo, useState } from "react";
import type { Group, MenuItem } from "./menuOptions";
import { MENU_ITEMS_DEFAULT, byGroup, groupsOf } from "./menuOptions";
// ---- Versioning ----
const FIXED_VERSION_TEXT = "v2.1.033";
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



// --- Lightweight dropdown (no deps), keyboard & click-outside ---
function Dropdown<T extends number>({
  value,
  options,
  onChange,
  labelFor,
}: {
  value: T;
  options: { value: T; label: string }[];
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
        <div className="absolute left-0 right-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] md:max-w-none max-h-[90vh] overflow-y-auto rounded-xl border border-green-300 bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={"w-full text-left px-4 py-3 md:py-2 text-lg border-b last:border-b-0 border-white/5 " + (opt.value===value ? "bg-emerald-100" : "hover:bg-white/5")}
            >
              <span className="inline-block align-middle whitespace-normal break-words">{opt.label}</span>
            </button>
          ))}
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

  
function applyCaptureStyles(rootEl?: HTMLElement) {
  // Inject CSS to normalize layout + snapshot inline rounding for fonts
  const style = document.createElement('style');
  style.id = '__capture_styles__';
  style.textContent = `
      html, body { -webkit-text-size-adjust: 100%; }
  `;
  document.head.appendChild(style);

  // Temporarily disable transforms inside root to avoid fractional baseline shifts
  const target = rootEl || document.querySelector('[data-capture-root]') as HTMLElement || document.body;
  const transformed: Array<{el: HTMLElement, prev: string}> = [];
  const fontPatched: Array<{el: HTMLElement, prevFont: string, prevLH: string, prevLS: string}> = [];

  if (target) {
    const all = target.querySelectorAll<HTMLElement>('*');
    all.forEach((el) => {
      const cs = window.getComputedStyle(el);
      // 5) Avoid CSS transforms during capture
      if (cs.transform && cs.transform !== 'none') {
        transformed.push({ el, prev: el.style.transform });
        el.style.transform = 'none';
      }
      // 1) フォント系を整数化（font-size / line-height / letter-spacing）
      const fs = cs.fontSize || '';
      const lh = cs.lineHeight || '';
      const ls = cs.letterSpacing || '';

      let newFs = el.style.fontSize;
      if (fs.endsWith('px')) {
        const v = Math.round(parseFloat(fs));
        newFs = v + 'px';
        el.style.fontSize = newFs;
      }
      let newLh = el.style.lineHeight;
      if (lh !== 'normal') {
        if (lh.endsWith('px')) {
          const v = Math.round(parseFloat(lh));
          newLh = v + 'px';
          el.style.lineHeight = newLh;
        } else if (/^\d+(\.\d+)?$/.test(lh)) {
          // unitless number -> clamp to integer multiplier to reduce fractions
          const v = Math.round(parseFloat(lh));
          newLh = String(v);
          el.style.lineHeight = newLh;
        }
      }
      let newLs = el.style.letterSpacing;
      if (ls.endsWith('px')) {
        const v = Math.round(parseFloat(ls));
        newLs = v + 'px';
        el.style.letterSpacing = newLs;
      }

      if (newFs || newLh || newLs) {
        fontPatched.push({ el, prevFont: el.style.fontSize, prevLH: el.style.lineHeight, prevLS: el.style.letterSpacing });
      }
    });
  }

  // Also force footer to static if exists
  const ft = document.querySelector('footer') as HTMLElement | null;
  const prevPos = ft ? ft.style.position : null;
  if (ft) ft.style.position = 'static';

  return () => {
    if (ft) ft.style.position = prevPos || '';
    // restore transforms and font styles
    transformed.forEach(({el, prev}) => { el.style.transform = prev || ''; });
    fontPatched.forEach(({el, prevFont, prevLH, prevLS}) => {
      el.style.fontSize = prevFont || '';
      el.style.lineHeight = prevLH || '';
      el.style.letterSpacing = prevLS || '';
    });
    style.remove();
  };
}
async function makePasswordPdf(pwd: string) {
    try {
      setPdfBusy(true);
      await ensurePdfDeps();
      await nextTick();
      const root = (document.getElementById("capture") as HTMLElement) || (document.querySelector('[data-capture-root]') as HTMLElement) || (document.getElementById("root") as HTMLElement) || (document.body as HTMLElement);
      // Ensure top-left origin and stable layout
      window.scrollTo(0, 0);
      if (!root) { throw new Error("capture root not found"); }
      const cleanup = applyCaptureStyles(root);
      // Declare outside try so we can use them after cleanup
      let dataUrl: string;
      let w: number;
      let h: number;
      try {
        const scale = 3; // integer scale for hi-res
        const r = root.getBoundingClientRect();
        const x = Math.round(r.left), y = Math.round(r.top);
        const wpx = Math.round(r.width), hpx = Math.round(r.height);
        const canvas = await (window as any).html2canvas(root, {
          scale,
          x, y, width: wpx, height: hpx,
          useCORS: true,
          backgroundColor: null,
          windowWidth: root.scrollWidth,
          windowHeight: root.scrollHeight
        });
        dataUrl = canvas.toDataURL("image/png");
        w = Math.floor(canvas.width); h = Math.floor(canvas.height);
      } catch (e) {
      console.error('PDF failed', e);
      alert('PDF作成に失敗しました。' + (e && (e as any).message ? '\n' + (e as any).message : '\nもう一度お試しください。'));
    } finally {
        cleanup();
      }

      const docDef: any = {
        compress: true,
        pageSize: { width: Math.floor(w), height: Math.floor(h) },
        pageMargins: [0, 0, 0, 0],
        permissions: {
          printing: "none",
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: false,
          documentAssembly: false,
        },
        userPassword: pwd,
        ownerPassword: pwd,
        content: [{ image: dataUrl, width: Math.floor(w), height: Math.floor(h) }],
      };
      const pdf = (window as any).pdfMake.createPdf(docDef);

      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date();
const fname = String(d.getMonth()+1).padStart(2,"0")
  + String(d.getDate()).padStart(2,"0") + "_" 
  + String(d.getHours()).padStart(2,"0")
  + String(d.getMinutes()).padStart(2,"0") + ".pdf";

      await new Promise<void>((resolve) => pdf.download(fname, resolve));

      pdf.getBlob(async (blob: Blob) => {
        try {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [new File([blob], fname, { type: "application/pdf" })] })) {
            await (navigator as any).share({
              files: [new File([blob], fname, { type: "application/pdf" })],
              title: "パスワード付きPDF",
              text: "作成したPDFを共有します。",
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

  useEffect(() => { saveRows(rows); }, [rows]);
  useEffect(() => { saveMenuItems(menuItems); }, [menuItems]);

  // ---- Version auto-increment (robust) ----
  const prevSnapRef = React.useRef<string | null>(null);

  useEffect(() => {
    // initialize snapshot once from storage or current state
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

  // 通常画面の「リセット」：
  // - グループ構成は維持
  // - 既定があるグループ(1..3)は既定メニューに置換、その他(4..6)は現状維持
  // - さらに、各行の選択を「一番上( index = 0 )」に揃える
  const handleReset = () => {
  // 通常画面の「リセット」：各メニュー項目を一番上(インデックス0)にするだけ。他は変更しない。
  const gs = groupsOf(menuItems);
  setRows(gs.map((g) => ({ group: g, index: 0 } as Row)));
};

  const handleEdit = () => setEditing(true);

  if (editing) {
    return (
      <MenuEditor
        items={menuItems}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          // 保存しても編集画面は閉じない
          setMenuItems(next);
          // rows は useEffect で自動同期
        }}
      />
    );
  }

  return (
    <div id="capture" data-capture-root className="min-h-dvh w-full overflow-x-hidden bg-green-50 text-green-900 flex flex-col text-[clamp(16px,2.7vw,18px)]">
      
      
      
      

      
      <header className="w-full max-w-3xl mx-auto pt-6 px-4">
        <div className="relative w-full flex items-baseline justify-center min-h-[48px]"><h1 className="absolute left-1/2 -translate-x-1/2 font-bold tracking-wide text-2xl sm:text-3xl md:text-4xl whitespace-nowrap">新メニュー表</h1><span className="absolute right-0 text-sm opacity-70">{FIXED_VERSION_TEXT}</span></div>
        <div className="w-full grid grid-cols-3 items-center mt-2">
          <div className="flex justify-start">
            <button
              onClick={() => setEditing(true)}
              className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              編集
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => setPdfOpen(true)}
              className="h-9 min-h-[36px] px-5 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              PDF
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
            >
              リセット
            </button>
          </div>
        </div>
      </header>
<main className="w-full max-w-3xl mx-auto px-4 mt-4 flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
        <div className="space-y-3">
          {rows.map((r, i) => {
            const list = byGroup(menuItems, r.group);
            return (
              <div key={i} className="rounded-xl border border-green-200 bg-white/70 shadow-sm flex items-center justify-between pl-2 pr-4 py-2">
                
    <Dropdown
      value={r.index as number}
      options={list.map((it, idx) => ({ value: idx as number, label: it.label }))}
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
            <input onFocus={() => { setKeyboardOpen(true); }} onBlur={() => { /* reset handled by vv listener*/ }}
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
  onSave,
}: {
  items: MenuItem[];
  onCancel: () => void;
  onSave: (items: MenuItem[]) => void;
}) {
  const [draft, setDraft] = useState<MenuItem[]>(() => items.map(i => ({ ...i })));
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
  <div className="w-full text-center">
    <h1 className="font-bold tracking-wide text-3xl md:text-4xl">メニュー編集</h1>
  </div>
  <div className="w-full grid grid-cols-3 items-center mt-2">
    <div className="flex justify-start">
      <button
        onClick={onCancel}
        className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white/80 hover:bg-white shadow-sm text-base md:text-lg"
      >
        ← 戻る
      </button>
    </div>
    <div className="flex justify-center">
      <button
        onClick={resetToDefault}
        className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-amber-300 bg-white/80 hover:bg-amber-50 shadow-sm text-base md:text-lg"
        title="既定メニューへ戻す（自動保存）"
      >
        既定に戻す
      </button>
    </div>
    <div className="flex justify-end">
      <button
        onClick={() => onSave(draft)}
        className="px-5 py-2 rounded-xl bg-green-600 text-white hover:brightness-110 shadow text-lg"
      >
        保存
      </button>
    </div>
  </div>
</header>

      <main className="w-full max-w-3xl mx-auto px-4 mt-4 flex-1 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
        <div className="w-full flex justify-center">
  <div className={"mb-2 rounded-xl border border-green-300 bg-white/80 overflow-hidden " + (groups.length >= 4 ? "grid grid-cols-3" : "inline-flex")}>
    {groups.map((g, idx) => (
      <button
        key={g}
        onClick={() => setTab(g)}
        className={
          "px-4 py-2 text-base md:text-lg font-medium " +
          (groups.length >= 4
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
            onClick={removeGroup}
            className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-600 shadow-sm text-base md:text-lg"
          >
            グループの削除
          </button>
          <button
            onClick={addGroup}
            className="h-9 min-h-[36px] px-4 whitespace-nowrap leading-none rounded-md border border-green-300 bg-white hover:bg-green-50 shadow-sm disabled:opacity-50 text-base md:text-lg"
            disabled={groups.length >= 6}
          >
            グループの追加
          </button>
        </div>

        <div className="rounded-xl border border-green-200 bg-white/70 shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(4.5ch,6.5ch)_32px] md:grid-cols-[minmax(0,1fr)_minmax(6ch,8ch)_48px] gap-2 p-3 items-center text-sm md:text-base font-medium text-green-700">
            <div>ラベル</div><div className="text-left pl-1">数値</div><div className="text-center md:text-right text-red-600">削除</div>
          </div>
          <div className="divide-y divide-green-100">
            {groupList(tab).map((row, idx) => (
              <div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(4.5ch,6.5ch)_32px] md:grid-cols-[minmax(0,1fr)_minmax(6ch,8ch)_48px] gap-2 p-3 items-center">
                <input
                  className="min-w-0 rounded-md border border-green-200 bg-white/90 px-2 py-2 outline-none text-lg md:text-xl"
                  value={row.label}
                  onChange={(e) => updateRow(tab, idx, { label: e.target.value })}
                  placeholder="メニュー名"
                />
                <input
                  className="w-[4.5ch] rounded-md border border-green-200 bg-white/90 px-2 py-2 text-right outline-none text-lg md:text-xl"
                  inputMode="decimal"
                  value={String(row.value)}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9.\-]/g, ""));
                    updateRow(tab, idx, { value: isFinite(n) ? n : 0 });
                  }}
                  placeholder="0"
                />
                <button
                  onClick={() => removeRow(tab, idx)}
                  className="px-2 py-2 w-8 text-center rounded-md border border-red-300 bg-white hover:bg-red-50 text-red-600 text-base md:text-lg"
                 aria-label="削除">☓</button>
              </div>
            ))}
            <div className="p-3 flex justify-end">
              <button
                onClick={() => addRow(tab)}
                className="px-4 py-2 rounded-md border border-green-300 bg-white hover:bg-green-50 text-base md:text-lg"
              >
                + 行を追加
              </button>
            </div>
          </div>
        </div>
      <div data-capture-hide className="h-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]"></div>
      </main>
    </div>
  );
}
