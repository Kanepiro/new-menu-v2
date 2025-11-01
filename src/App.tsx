import React from "react";

const FIXED_VERSION_TEXT = "v2.1.100";

export default function App() {
  return (
    <div className="min-h-screen bg-[#e9f6ee] text-gray-800">
      <div className="fixed top-0 left-0 right-0 z-[3000] text-xs md:text-sm px-3 py-2 bg-white/90 border-b border-green-200 shadow-sm">
        <strong>SAFE MODE</strong>
        <span className="ml-2">Version: {FIXED_VERSION_TEXT}</span>
      </div>
      <div className="pt-14 px-4">
        <h1 className="text-lg font-semibold mb-2">描画テスト</h1>
        <p>この画面が見えていれば、ビルドとマウントは正常です。</p>
        <p className="mt-2 opacity-70">（元のUIはこの後、最小差分で復帰させます）</p>
      </div>
    </div>
  );
}
