import React from "react";
import type { Group, MenuItem } from "./menuOptions";
import { MENU_ITEMS_DEFAULT, byGroup, groupsOf } from "./menuOptions";

/* Error guard to avoid blank screen */
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError:boolean; msg?:string}>{
  constructor(props:any){super(props); this.state={hasError:false};}
  static getDerivedStateFromError(err:any){return {hasError:true, msg:String((err&&err.message)||err)};}
  componentDidCatch(err:any, info:any){console.error(err, info);}
  render(){ if(this.state.hasError){ return (
    <div className="p-4 text-sm">
      <div className="mb-2 font-semibold">エラーが発生しました</div>
      <pre className="whitespace-pre-wrap break-words">{this.state.msg}</pre>
    </div>
  ); } return this.props.children as any; }
}

const FIXED_VERSION_TEXT = "v2.1.106";

/* Modal Dropdown (guarded) */
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

export default function App(){
  // Use provided constants safely
  const baseItems: MenuItem[] = Array.isArray(MENU_ITEMS_DEFAULT)? MENU_ITEMS_DEFAULT : [];
  const groups: Group[] = (typeof groupsOf==="function" && baseItems.length>0) ? groupsOf(baseItems) : ([1] as Group[]);

  const optionsFor = (g: Group) => {
    const list = typeof byGroup==="function" ? byGroup(baseItems, g) : baseItems;
    return list.map((it, idx)=>({value: idx as number, label: it.label})) as {value:number; label:string}[];
  };

  // show 3 rows for now
  const [rows, setRows] = React.useState<Array<{group: Group; index: number}>>(
    new Array(3).fill(0).map(()=>({group: groups[0], index: 0}))
  );

  // --- Header buttons (placeholders) ---
  const onEdit = () => { console.log("編集 clicked"); };
  const onPDF = () => { console.log("PDF clicked"); };
  const onReset = () => { console.log("リセット clicked"); };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#e9f6ee] text-gray-800">
        <header className="sticky top-0 z-[500] bg-white/80 backdrop-blur border-b border-green-200">
          <div className="mx-auto max-w-screen-sm px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">新メニュー表</div>
              <div className="text-xs opacity-70">{FIXED_VERSION_TEXT}</div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button id="btn-edit" onClick={onEdit} className="px-3 py-2 rounded-lg border border-green-300 bg-white/70 hover:bg-white shadow-sm">編集</button>
              <button id="btn-pdf" onClick={onPDF} className="px-3 py-2 rounded-lg border border-green-300 bg-white/70 hover:bg-white shadow-sm">PDF</button>
              <button id="btn-reset" onClick={onReset} className="px-3 py-2 rounded-lg border border-green-300 bg-white/70 hover:bg-white shadow-sm">リセット</button>
            </div>
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
                    setRows(prev=>{const next=[...prev]; next[i]={...prev[i], index:Number(index)}; return next;});
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
