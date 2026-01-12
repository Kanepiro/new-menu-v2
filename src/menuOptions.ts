export type Group = 1 | 2 | 3 | 4 | 5 | 6;
export type MenuItem = { group: Group; label: string; value: number };

// 既定メニュー（CSV由来の初期値：1..3のみ定義、4..6は空）
export const MENU_ITEMS_DEFAULT: MenuItem[] = [
  { group: 1, label: "☕お茶🍽食事 1h(1.5)", value: 1.5 },
  { group: 1, label: "☕お茶🍽食事 2h(3)", value: 3 },
  { group: 1, label: "⏰時間延長 +1h(5)", value: 5 },
  { group: 1, label: "⏰時間延長 +2h(7)", value: 7 },
  { group: 1, label: "⏰時間延長 +3h(9)", value: 9 },
  { group: 1, label: "⏰時間延長 +4h(11)", value: 11 },
  { group: 1, label: "⏰時間延長 +5h(13)", value: 13 },
  { group: 1, label: "⏰時間延長 +6h(15)", value: 15 },
  { group: 1, label: "🛏お泊り(30)", value: 30 },
  { group: 2, label: "👗コス📷撮影😔無し(0)", value: 0 },
  { group: 2, label: "👗コス📷撮影😍有り(5)", value: 5 },
  { group: 3, label: "🥰無し😔(0)", value: 0 },
  { group: 3, label: "🥰有り😲ゴム🚀x1(5)", value: 5 },
  { group: 3, label: "🥰有り🤩生中🚀x1(10)", value: 10 },
  { group: 3, label: "🥰有り😲ゴム🚀💥？(8)", value: 8 },
  { group: 3, label: "🥰有り🤩生中🚀💥？(15)", value: 15 }
] as const;

export const byGroup = (items: MenuItem[], g: Group) => items.filter(v => v.group === g);
export const groupsOf = (items: MenuItem[]) => Array.from(new Set(items.map(d => d.group))).sort((a,b)=>a-b) as Group[];
