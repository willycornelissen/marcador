// Parser e writer do formato Netscape HTML (padrão de export de bookmarks dos
// navegadores e do booky.io). No navegador usa DOMParser/textContent; em Node
// (script de seed) usa um parser de pilha equivalente. Nunca usa innerHTML com
// conteúdo externo (XSS): só extrai texto/atributos.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  atilde: 'ã', otilde: 'õ', ntilde: 'ñ',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
  ccedil: 'ç', aring: 'å', szlig: 'ß',
  deg: '°', plusmn: '±', times: '×', divide: '÷', middot: '·', bull: '•',
  copy: '©', reg: '®', trade: '™', micro: 'µ', euro: '€', pound: '£',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  hellip: '…', minus: '−',
}

function decodeEntities(s) {
  return String(s).replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

function parseAttrs(s) {
  const out = {}
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"|([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*'([^']*)'/g
  let m
  while ((m = re.exec(s))) {
    out[(m[1] || m[3]).toLowerCase()] = decodeEntities(m[2] ?? m[4] ?? '')
  }
  return out
}

// Parser de pilha (Node, sem DOM). Suporta a forma regular do formato Netscape:
//   <DL> <DT><H3>pasta</H3> <DL><p> <DT><A HREF="u">nome</A><DD>nota … </DL> </DL>
function parseWithStack(html) {
  let root = null
  const stack = []
  let pendingFolder = null
  let lastLink = null
  let inH3 = false
  let inA = false

  const re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s[^<>]*)?)>|([^<]+)/g
  let m
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      const text = decodeEntities(m[4])
      if (inH3 && pendingFolder) pendingFolder.name += text
      else if (inA && lastLink) lastLink.name += text
      else if (lastLink && lastLink._dd) lastLink.note += text
      continue
    }
    const closing = m[1] === '/'
    const tag = m[2].toUpperCase()
    if (closing) {
      if (tag === 'H3') inH3 = false
      else if (tag === 'A') inA = false
      else if (tag === 'DL') stack.pop()
      continue
    }
    switch (tag) {
      case 'H3': {
        pendingFolder = { type: 'folder', name: '', children: [] }
        if (stack.length > 0) stack[stack.length - 1].children.push(pendingFolder)
        inH3 = true
        break
      }
      case 'A': {
        const attrs = parseAttrs(m[3])
        lastLink = { type: 'link', name: '', url: attrs.href || '', note: '', _dd: false }
        if (stack.length > 0) stack[stack.length - 1].children.push(lastLink)
        inA = true
        break
      }
      case 'DD':
        if (lastLink) lastLink._dd = true
        break
      case 'DL': {
        if (pendingFolder) {
          stack.push(pendingFolder)
        } else {
          const anon = { type: 'folder', name: null, children: [] }
          if (!root) root = anon
          stack.push(anon)
        }
        pendingFolder = null
        break
      }
      default:
        break
    }
  }
  return root
}

// Parser via DOM (navegador). O DOMParser decodifica entidades e normaliza HTML.
function parseWithDom(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rootDl = doc.querySelector('dl')
  if (!rootDl) return null

  function walkDl(dl) {
    const out = []
    for (const node of dl.children) {
      if (node.tagName !== 'DT') continue
      const h3 = node.querySelector(':scope > h3')
      const a = node.querySelector(':scope > a')
      if (h3) {
        const folder = {
          type: 'folder',
          name: (h3.textContent || '').trim(),
          children: [],
        }
        const next = node.querySelector(':scope > dl')
        if (next) folder.children = walkDl(next)
        out.push(folder)
      } else if (a) {
        const noteEl = node.nextElementSibling
        out.push({
          type: 'link',
          name: (a.textContent || '').trim(),
          url: a.getAttribute('href') || '',
          note: noteEl && noteEl.tagName === 'DD' ? (noteEl.textContent || '').trim() : '',
        })
      }
    }
    return out
  }

  return { type: 'folder', name: null, children: walkDl(rootDl) }
}

// Converte a árvore bruta no catálogo esperado:
//   [{ name, categories: [{ name, bookmarks: [{ name, url, note }] }] }]
// Pastas no nível 1 viram coleções; pastas no nível 2 viram categorias; links
// viram bookmarks. Links soltos numa coleção viram a categoria "Sem categoria".
function normalizeTree(children) {
  const catalog = []
  for (const item of children) {
    if (item.type !== 'folder') continue
    const collection = { name: (item.name || '').trim(), categories: [] }
    const loose = []
    for (const sub of item.children || []) {
      if (sub.type === 'folder') {
        collection.categories.push({
          name: (sub.name || '').trim(),
          bookmarks: (sub.children || [])
            .filter((x) => x.type === 'link')
            .map((x) => ({
              name: (x.name || '').trim(),
              url: x.url || '',
              note: (x.note || '').trim(),
            })),
        })
      } else if (sub.type === 'link') {
        loose.push({
          name: (sub.name || '').trim(),
          url: sub.url || '',
          note: (sub.note || '').trim(),
        })
      }
    }
    if (loose.length > 0) {
      collection.categories.push({ name: 'Sem categoria', bookmarks: loose })
    }
    catalog.push(collection)
  }
  return catalog
}

// Converte o HTML Netscape em um catálogo (padrão booky.io: coleções → categorias → bookmarks).
export function parseNetscape(html) {
  const tree = typeof DOMParser !== 'undefined' ? parseWithDom(html) : parseWithStack(html)
  return normalizeTree(tree?.children || [])
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pad(n) {
  return '  '.repeat(n)
}

// Converte um catálogo em HTML Netscape (importável no booky.io/navegadores).
export function buildNetscape(catalog, title = 'booky.io Bookmarks') {
  const out = []
  out.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
  out.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">')
  out.push(`<TITLE>${esc(title)}</TITLE>`)
  out.push('<style>')
  out.push('  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px auto; max-width: 800px; line-height: 1.5; color: #1f2937; }')
  out.push('  dl { margin: 4px 0; padding-left: 28px; list-style-type: none; }')
  out.push('  dt { margin: 6px 0; }')
  out.push('  h3 { margin: 12px 0 6px 0; font-family: inherit; }')
  out.push('  /* Coleções (Nível 1) */')
  out.push('  body > dl > dt > h3 { color: #1d4ed8; font-size: 1.3rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px; }')
  out.push('  /* Categorias (Nível 2) */')
  out.push('  body > dl > dt > dl > dt > h3 { color: #0d9488; font-size: 1.1rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 2px; margin-top: 16px; }')
  out.push('  /* Bookmarks (Nível 3) */')
  out.push('  a { color: #2563eb; text-decoration: none; font-weight: 500; }')
  out.push('  a:hover { text-decoration: underline; color: #1d4ed8; }')
  out.push('  dd { margin: 2px 0 10px 28px; color: #4b5563; font-size: 0.875rem; font-style: italic; }')
  out.push('</style>')
  out.push(`<H1>${esc(title)}</H1>`)
  out.push('<DL><p>')

  for (const col of catalog) {
    out.push(`${pad(1)}<DT><H3>${esc(col.name)}</H3>`)
    out.push(`${pad(1)}<DL><p>`)
    for (const cat of col.categories || []) {
      out.push(`${pad(2)}<DT><H3>${esc(cat.name)}</H3>`)
      out.push(`${pad(2)}<DL><p>`)
      for (const bm of cat.bookmarks || []) {
        out.push(
          `${pad(3)}<DT><A HREF="${esc(bm.url)}">${esc(bm.name)}</A>` +
            (bm.note ? `<DD>${esc(bm.note)}` : '')
        )
      }
      out.push(`${pad(2)}</DL><p>`)
    }
    out.push(`${pad(1)}</DL><p>`)
  }
  out.push('</DL>')
  return out.join('\n')
}
