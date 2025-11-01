import React from "react";
import type { Group, MenuItem } from "./menuOptions";
import { MENU_ITEMS_DEFAULT, byGroup, groupsOf } from "./menuOptions";
import { createClient } from "@supabase/supabase-js";

/* ---- Error Boundary to avoid blank screen ---- */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, msg: undefined };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: String((err && err.message) || err) };
  }
  componentDidCatch(err: any, info: any) {
    console.error(err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm">
          <div className="mb-2 font-semibold">エラーが発生しました</div>
          <pre className="whitespace-pre-wrap break-words">{this.state.msg}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const FIXED_VERSION_TEXT = "v2.1.103";

// ---- Cloud (guarded,未使用) ----
const SHARED_KEY_B64 = "pAHI97yfr67P9Gui4oPyApIyjnk/rDCqqRKo5VWiMKY=";
const CLOUD_OBJECT_PATH = "siCNDuBOVj76ZTKScao8.menu.enc";
const supabase =
  (import.meta as any)?.env?.VITE_SUPABASE_URL &&
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY
    ? createClient(
        (import.meta as any).env.VITE_SUPABASE_URL,
        (import.meta as any).env.VITE_SUPABASE_ANON_KEY
      )
    : (null as any);

// ---- Modal Dropdown (guarded) ----
function Dropdown<T extends number>({
  value, options, onChange
}: { value: T; options: { value: T; label: string }[]; onChange: (v:T)=>void; }){
  const [open,setOpen]=React.useState(false);
  const openerRef = React.useRef<HTMLButtonElement|null>(null);
  React.useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)}; if(open)document.addEventListener("keydown",h); return ()=>document.removeEventListener("keydown",h);},[open]);
  const safeOptions = Array.isArray(options)?options:[];
  const current = safeOptions.find(o=>o.value===value);
  return (<>
    <button ref={openerRef} type="button" aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>setOpen(true)}
      className="w-full text-left px-4 py-3 rounded-xl border border-green-300 bg-white/70 hover:bg-white/90 shadow-sm">
      <span className="inline-block align-middle">{current?current.label:"選択..."}</span>
      <span className="float-right opacity-70">▾</span>
    </button>
    {open&&(<div role="dialog" aria-modal="true"
      className="fixed inset-0 z-[1000] bg-black/30 flex items-center justify-center p-3"
      onClick={(e)=>{if(e.target===e.currentTarget)setOpen(false);}}>
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-green-300">
        <div className="sticky top-0 bg-white/95 border-b border-green-200 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">メニューを選択</div>
          <button type="button" className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50" onClick={()=>setOpen(false)}>閉じる</button>
        </div>
        <div className="py-2">
          {safeOptions.map(opt=>(
            <button key={String(opt.value)} role="option" aria-selected={opt.value===value}
              onClick={()=>{onChange && onChange(opt.value); setOpen(false); setTimeout(()=>openerRef.current?.focus(),0);}}
              className={"w-full text-left px-4 py-3 text-[15px] border-b last:border-b-0 "+(opt.value===value?"bg-green-100":"hover:bg-green-50")}>
              <span className="inline-block align-middle whitespace-normal break-words">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>)}
  </>);
}

// ---- App ----
export default function App(){
  // 安全フォールバック
  const baseItems: MenuItem[] = Array.isArray(MENU_ITEMS_DEFAULT) && MENU_ITEMS_DEFAULT.length>0
    ? MENU_ITEMS_DEFAULT
    : [{label:"☕ お茶", price:500, group:0 as Group},{label:"🍴 食事 1h(1.5)", price:700, group:0 as Group}];
  const groups = typeof groupsOf==="function" ? groupsOf(baseItems) : ([0] as Group[]);
  const optionsFor = (g: Group) => {
    const list = typeof byGroup==="function" ? byGroup(baseItems, g) : baseItems;
    return list.map((it, idx)=>({value: idx as number, label: it.label})) as {value:number; label:string}[];
  };

  // 3行分の行を見えるように初期化（編集機能は最小化）
  const [rows, setRows] = React.useState<Array<{group: Group; index: number}>>(
    new Array(3).fill(0).map(()=>({group: groups[0], index: 0}))
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#e9f6ee] text-gray-800">
        <header className="sticky top-0 z-[500] bg-white/80 backdrop-blur border-b border-green-200">
          <div className="mx-auto max-w-screen-sm px-3 py-2 flex items-center justify-between">
            <div className="font-semibold">新メニュー表</div>
            <div className="text-xs opacity-70">{FIXED_VERSION_TEXT}</div>
          </div>
        </header>

        <main className="mx-auto max-w-screen-sm px-3 py-4 space-y-3">
          {rows.map((r,i)=>{
            const opts = optionsFor(r.group);
            return (
              <div key={i} className="rounded-xl border border-green-200 bg-white/80 shadow-sm p-3">
                <div className="text-xs mb-1 opacity-70">グループ {String(r.group)}</div>
                <Dropdown
                  value={r.index as number}
                  options={opts}
                  onChange={(index:number)=>{
                    setRows(prev=>{const next=[...prev]; next[i]={...next[i], index:Number(index)}; return next;});
                  }}
                />
              </div>
            );
          })}
        </main>
      </div>
    </ErrorBoundary>
  );
}
