const PALETTE = [
  '#d97706',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#84cc16',
  '#ca8a04',
  '#78716c',
]

export function colorFor(name) {
  let h = 0
  const s = String(name || '')
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return PALETTE[h % PALETTE.length]
}
