import { useEffect, useMemo, useState } from 'react'
import { auth } from './lib/firebase'
import { onAuthChange, signIn, signOut } from './lib/auth'
import {
  addBookmark,
  addCategory,
  addCollection,
  deleteBookmark,
  deleteCategory,
  deleteCollection,
  importCatalog,
  setBookmarkFavorite,
  subscribeData,
  updateBookmark,
  updateCollectionFavorites,
} from './lib/bookmarks'
import { buildNetscape, parseNetscape } from './lib/netscape'
import { colorFor } from './lib/colors'
import './App.css'

const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL || 'willy.cornelissen@gmail.com'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function byName(a, b) {
  return (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' })
}

function faviconUrl(host) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

function Favicon({ url, name }) {
  const host = hostOf(url)
  const [src, setSrc] = useState(host ? faviconUrl(host) : null)
  useEffect(() => {
    setSrc(host ? faviconUrl(host) : null)
  }, [host])
  if (src) {
    return (
      <img
        className="bm-fav"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setSrc(null)}
      />
    )
  }
  return (
    <div className="bm-fav bm-fav-letter">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function LoginForm({ onMessage }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      onMessage('Bem-vindo de volta!')
    } catch {
      setError('Não deu para entrar. Verifique e-mail e senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={handleSubmit}>
      <h2>Entrar</h2>
      {error && <div className="warning">{error}</div>}
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <button type="submit" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function BookmarkModal({ bookmark, defaultCategoryId, onSave, onClose }) {
  const [name, setName] = useState(bookmark?.name || '')
  const [url, setUrl] = useState(bookmark?.url || '')
  const [note, setNote] = useState(bookmark?.note || '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const categoryId = defaultCategoryId || bookmark?.categoryIds?.[0] || null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) {
      setError('Preencha nome e URL.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(
        { name: name.trim(), url: url.trim(), note: note.trim() },
        categoryId ? [categoryId] : []
      )
      onClose()
    } catch {
      setError('Não deu para salvar.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-wrap" onClick={onClose}>
      <form
        className="modal"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{bookmark ? 'Editar bookmark' : 'Novo bookmark'}</h3>
        {error && <div className="warning">{error}</div>}
        <div className="field">
          <label>Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="field">
          <label>Nota (opcional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ImportExport({ catalog, onImported, onMessage }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseNetscape(text)
      if (parsed.length === 0) {
        throw new Error('Nenhuma coleção encontrada no arquivo.')
      }
      parsed.forEach((col) => {
        col.color = colorFor(col.name)
        ;(col.categories || []).forEach((cat) => {
          cat.color = colorFor(cat.name)
        })
      })
      const counts = parsed.reduce(
        (acc, col) => {
          acc.collections++
          acc.categories += (col.categories || []).length
          acc.bookmarks += (col.categories || []).reduce(
            (n, cat) => n + (cat.bookmarks || []).length,
            0
          )
          return acc
        },
        { collections: 0, categories: 0, bookmarks: 0 }
      )
      await importCatalog(parsed)
      onImported(counts)
    } catch (err) {
      setError(err.message || 'Falha no import.')
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      const text = buildNetscape(catalog)
      const blob = new Blob([text], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      a.download = `marcador-${dateStr}.html`
      a.click()
      URL.revokeObjectURL(url)
      onMessage('Export gerado.')
    } catch {
      setError('Falha no export.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="import-export">
      {error && <div className="warning">{error}</div>}
      <label className="btn ghost">
        Importar HTML…
        <input
          type="file"
          accept=".html,.htm"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </label>
      <button
        className="btn ghost"
        onClick={handleExport}
        disabled={busy || catalog.length === 0}
      >
        {busy ? 'Trabalhando…' : 'Exportar HTML…'}
      </button>
    </div>
  )
}

function BookmarkCombo({ bm, canEdit, onEdit, onDelete, onToggleFavorite }) {
  const [open, setOpen] = useState(true)
  return (
    <section className={`cat-card${open ? ' open' : ''}${bm.favorite ? ' favorite' : ''}`}>
      <button
        className="cat-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cat-name">
          <Favicon url={bm.url} name={bm.name} />
          <span className="cat-name-text">{bm.name}</span>
        </span>
        <span className="cat-head-right">
          <svg className="chev" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="bm-combo-body">
          <a className="bm-title" href={bm.url} target="_blank" rel="noreferrer">
            {hostOf(bm.url) || bm.url}
          </a>
          {bm.note && <div className="bm-note">{bm.note}</div>}
          {canEdit && (
            <div className="bm-actions">
              <button
                className={`icon-btn fav-star${bm.favorite ? ' on' : ''}`}
                title={
                  bm.favorite
                    ? 'Remover dos favoritos'
                    : 'Adicionar aos favoritos'
                }
                onClick={() => onToggleFavorite(bm)}
              >
                {bm.favorite ? '★' : '☆'}
              </button>
              <button className="icon-btn" title="Editar" onClick={() => onEdit(bm)}>
                ✎
              </button>
              <button
                className="icon-btn danger"
                title="Remover"
                onClick={() => onDelete(bm)}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SearchResults({ results, canEdit, onEdit, onDelete }) {
  return (
    <div className="search-list">
      <div className="content-title">Busca</div>
      <p className="hint">
        {results.length} resultado{results.length === 1 ? '' : 's'}.
      </p>
      {results.length === 0 && (
        <div className="cat-empty">Nada encontrado.</div>
      )}
      {results.map((bm) => (
        <article className="bm" key={bm.id}>
          <Favicon url={bm.url} name={bm.name} />
          <div className="bm-main">
            <a
              className="bm-title"
              href={bm.url}
              target="_blank"
              rel="noreferrer"
            >
              {bm.name}
            </a>
            <div className="bm-url">{hostOf(bm.url) || bm.url}</div>
            {bm.note && <div className="bm-note">{bm.note}</div>}
          </div>
          {canEdit && (
            <div className="bm-actions">
              <button
                className="icon-btn"
                title="Editar"
                onClick={() => onEdit(bm)}
              >
                ✎
              </button>
              <button
                className="icon-btn danger"
                title="Remover"
                onClick={() => onDelete(bm)}
              >
                ✕
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [collections, setCollections] = useState([])
  const [categories, setCategories] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [links, setLinks] = useState([])
  const [activeCollectionId, setActiveCollectionId] = useState(null)
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRightOpen, setDrawerRightOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  )

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    setFirebaseReady(!!auth)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('marcador-theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    if (!auth) return
    return subscribeData((update) => {
      // update() devolve só a fatia que mudou; aplica apenas essa.
      const next = update({})
      if ('collections' in next) setCollections(next.collections)
      if ('categories' in next) setCategories(next.categories)
      if ('bookmarks' in next) setBookmarks(next.bookmarks)
      if ('links' in next) setLinks(next.links)
    })
  }, [])

  useEffect(() => {
    if (!auth) return
    return onAuthChange((u) => {
      setUser(u)
      setShowLogin(false)
    })
  }, [])

  const sortedCollections = useMemo(
    () => [...collections].sort(byName),
    [collections]
  )

  useEffect(() => {
    if (activeCollectionId && !collections.some((c) => c.id === activeCollectionId)) {
      setActiveCollectionId(sortedCollections[0]?.id || null)
      setActiveCategoryId(null)
    }
  }, [collections, sortedCollections, activeCollectionId])

  function flash(message, kind = 'notice') {
    setNotice({ message, kind })
    setTimeout(() => setNotice(null), 5000)
  }

  const activeCollection =
    sortedCollections.find((c) => c.id === activeCollectionId) || sortedCollections[0] || null

  const activeCategory =
    categories.find(
      (c) => c.id === activeCategoryId && c.collectionId === activeCollection?.id
    ) || null

  const rightCats = categories
    .filter((c) => c.collectionId === activeCollection?.id)
    .sort(byName)

  const favoriteCats = (activeCollection?.favoriteCategoryIds || [])
    .map((id) => rightCats.find((c) => c.id === id))
    .filter(Boolean)
    .sort(byName)

  const categoriesByBookmark = useMemo(() => {
    const map = new Map()
    for (const link of links) {
      if (!map.has(link.bookmarkId)) map.set(link.bookmarkId, [])
      map.get(link.bookmarkId).push(link.categoryId)
    }
    return map
  }, [links])

  const linksByCategory = useMemo(() => {
    const map = new Map()
    for (const link of links) {
      if (!map.has(link.categoryId)) map.set(link.categoryId, [])
      map.get(link.categoryId).push(link.bookmarkId)
    }
    return map
  }, [links])

  const bookmarksById = useMemo(() => {
    const map = new Map()
    for (const bm of bookmarks) map.set(bm.id, bm)
    return map
  }, [bookmarks])

  const catBookmarks = useMemo(() => {
    if (!activeCategory) return []
    return (linksByCategory.get(activeCategory.id) || [])
      .map((id) => bookmarksById.get(id))
      .filter(Boolean)
      .sort(
        (a, b) =>
          Number(!!b.favorite) - Number(!!a.favorite) || byName(a, b)
      )
  }, [activeCategory, linksByCategory, bookmarksById])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return bookmarks
      .filter(
        (bm) =>
          bm.name.toLowerCase().includes(q) ||
          bm.url.toLowerCase().includes(q) ||
          (bm.note || '').toLowerCase().includes(q)
      )
      .sort(byName)
  }, [search, bookmarks])

  const exportedCatalog = useMemo(() => {
    return sortedCollections.map((col) => {
      const colCats = categories
        .filter((cat) => cat.collectionId === col.id)
        .sort(byName)

      const nestedCategories = colCats.map((cat) => {
        const catBmIds = linksByCategory.get(cat.id) || []
        const catBms = catBmIds
          .map((id) => bookmarksById.get(id))
          .filter(Boolean)
          .sort(
            (a, b) =>
              Number(!!b.favorite) - Number(!!a.favorite) || byName(a, b)
          )

        return {
          name: cat.name,
          bookmarks: catBms.map((bm) => ({
            name: bm.name,
            url: bm.url,
            note: bm.note || '',
          })),
        }
      })

      return {
        name: col.name,
        categories: nestedCategories,
      }
    })
  }, [sortedCollections, categories, linksByCategory, bookmarksById])

  function countBookmarksFor(colId, cats) {
    const catIds = new Set(cats.filter((c) => c.collectionId === colId).map((c) => c.id))
    let total = 0
    for (const link of links) {
      if (catIds.has(link.categoryId)) total++
    }
    return total
  }

  function handleSaveBookmark(fields, categoryIds) {
    if (modal?.bookmark) {
      return updateBookmark(modal.bookmark.id, fields, categoryIds)
    }
    return addBookmark(fields, categoryIds)
  }

  function handleToggleFavorite(bm) {
    return setBookmarkFavorite(bm.id, !bm.favorite).catch(() =>
      flash('Não deu para atualizar o favorito.', 'warning')
    )
  }

  function handleAddCollection() {
    const name = window.prompt('Nome da coleção:')
    if (!name || !name.trim()) return
    addCollection(name.trim())
      .then(() => flash(`Coleção "${name.trim()}" criada.`))
      .catch(() => flash('Não deu para criar a coleção.'))
  }

  function toggleFavorite(cat) {
    const current = (activeCollection?.favoriteCategoryIds || []).filter((id) =>
      rightCats.some((c) => c.id === id)
    )
    if (current.includes(cat.id)) {
      return updateCollectionFavorites(
        activeCollection.id,
        current.filter((id) => id !== cat.id)
      ).catch(() => flash('Não deu para atualizar os favoritos.', 'warning'))
    }
    if (current.length >= 3) {
      flash('A lista de favoritos está cheia. Remova uma categoria da lista primeiro.', 'warning')
      return
    }
    return updateCollectionFavorites(activeCollection.id, [...current, cat.id]).catch(
      () => flash('Não deu para atualizar os favoritos.', 'warning')
    )
  }

  return (
    <div className="app">
      {notice && (
        <div className={`${notice.kind} bar`}>{notice.message}</div>
      )}
      <header className="header">
        <button className="hamb" onClick={() => setDrawerOpen((v) => !v)}>
          <span />
          <span />
        </button>
        <a className="logo" href="#">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            </svg>
          </span>
          Marcador
        </a>
        <div className="search">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <button
            className="side-toggle"
            title="Categorias"
            aria-label="Abrir categorias"
            onClick={() => setDrawerRightOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            className="theme-toggle"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {user ? (
            <>
              <span className="header-user">{user.email}</span>
              {isAdmin && (
                <button className="btn ghost" onClick={signOut}>
                  Sair
                </button>
              )}
            </>
          ) : (
            <button className="btn ghost" onClick={() => setShowLogin((v) => !v)}>
              {showLogin ? 'Fechar' : 'Entrar'}
            </button>
          )}
        </div>
      </header>

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      {drawerRightOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerRightOpen(false)} />
      )}

      <div className="body">
        <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
          <div className="side-label">Coleções</div>
          {sortedCollections.map((col) => {
            const colCount = countBookmarksFor(col.id, categories)
            const hasCategories = categories.some((c) => c.collectionId === col.id)
            return (
              <div
                key={col.id}
                className={`side-item${col.id === activeCollection?.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveCollectionId(col.id)
                  setActiveCategoryId(null)
                  setDrawerOpen(false)
                }}
              >
                <span className="side-name">
                  <span
                    className="swatch"
                    style={{
                      background: `color-mix(in srgb, ${col.color} 28%, transparent)`,
                      boxShadow: `inset 0 0 0 1px ${col.color}40`,
                    }}
                  />
                  {col.name}
                </span>
                <span className="side-right">
                  <span className="count">{colCount}</span>
                  {isAdmin && !hasCategories && (
                    <button
                      className="icon-btn danger"
                      title="Remover"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!window.confirm(`Apagar a coleção "${col.name}"?`)) return
                        deleteCollection(col.id)
                          .then(() => flash(`Coleção "${col.name}" apagada.`))
                          .catch(() => flash('Não deu para apagar a coleção.'))
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
            )
          })}
          {isAdmin && (
            <>
              <button className="btn ghost side-new" onClick={handleAddCollection}>
                + Nova coleção
              </button>
              <ImportExport
                catalog={exportedCatalog}
                onMessage={flash}
                onImported={(c) =>
                  flash(
                    `Importado: ${c.collections} coleções, ${c.categories} categorias e ${c.bookmarks} bookmarks.`
                  )
                }
              />
            </>
          )}
        </aside>

        <main className="content">
          {!firebaseReady ? (
            <div className="warning">
              Firebase não configurado. Copie o arquivo <code>.env.example</code>{' '}
              para <code>.env</code> e preencha com os dados do seu projeto.
            </div>
          ) : search.trim() ? (
            <SearchResults
              results={searchResults || []}
              canEdit={isAdmin}
              onEdit={(bm) =>
                setModal({
                  bookmark: {
                    ...bm,
                    categoryIds: categoriesByBookmark.get(bm.id) || [],
                  },
                })
              }
              onDelete={(bm) => {
                if (!window.confirm(`Apagar "${bm.name}"?`)) return
                deleteBookmark(bm.id)
                  .then(() => flash('Bookmark apagado.'))
                  .catch(() => flash('Não deu para apagar.'))
              }}
            />
          ) : activeCategory ? (
            <div className="cats">
              <div className="cats-head">
                <span className="cats-title">{activeCategory.name}</span>
                {isAdmin && (
                  <button
                    className="btn primary"
                    onClick={() => setModal({ defaultCategoryId: activeCategory.id })}
                  >
                    ＋ Adicionar bookmark
                  </button>
                )}
              </div>
              {catBookmarks.length === 0 && (
                <div className="cat-empty">Sem bookmarks nesta categoria.</div>
              )}
              {catBookmarks.map((bm) => (
                <BookmarkCombo
                  key={bm.id}
                  bm={bm}
                  canEdit={isAdmin}
                  onEdit={(bm) =>
                    setModal({
                      bookmark: {
                        ...bm,
                        categoryIds: categoriesByBookmark.get(bm.id) || [],
                      },
                      defaultCategoryId: activeCategory.id,
                    })
                  }
                  onDelete={(bm) => {
                    if (!window.confirm(`Apagar "${bm.name}"?`)) return
                    deleteBookmark(bm.id)
                      .then(() => flash('Bookmark apagado.'))
                      .catch(() => flash('Não deu para apagar.'))
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <p className="hint">
              {activeCollection
                ? 'Escolha uma categoria na barra à direita.'
                : 'Nenhuma coleção ainda.'}
            </p>
          )}

          {showLogin && !user && firebaseReady && (
            <LoginForm onMessage={flash} />
          )}
        </main>

        <aside className={`sidebar right${drawerRightOpen ? ' open' : ''}`}>
          <div className="panel-head">
            {activeCollection && (
              <span className="panel-head-name">
                <span
                  className="swatch"
                  style={{
                    background: `color-mix(in srgb, ${activeCollection.color || '#78716c'} 28%, transparent)`,
                    boxShadow: `inset 0 0 0 1px ${activeCollection.color || '#78716c'}40`,
                  }}
                />
                <span className="panel-head-name-text">{activeCollection.name}</span>
              </span>
            )}
            <div className="panel-favs">
              {favoriteCats.length === 0 ? (
                <span className="panel-head-sub">Sem categorias favoritas</span>
              ) : (
                <>
                  <div className="panel-favs-title">Favoritas</div>
                  {favoriteCats.map((cat) => (
                    <div
                      key={cat.id}
                      className={`fav-item${cat.id === activeCategory?.id ? ' active' : ''}`}
                    >
                      <a
                        className="fav-link"
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveCategoryId(
                            cat.id === activeCategory?.id ? null : cat.id
                          )
                          setDrawerRightOpen(false)
                        }}
                      >
                        <span
                          className="swatch"
                          style={{
                            background: `color-mix(in srgb, ${cat.color} 28%, transparent)`,
                            boxShadow: `inset 0 0 0 1px ${cat.color}40`,
                          }}
                        />
                        <span className="fav-name">{cat.name}</span>
                      </a>
                      {isAdmin && (
                        <button
                          className="icon-btn fav-star on"
                          title="Remover dos favoritos"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(cat)
                          }}
                        >
                          ★
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          {rightCats.length === 0 && (
            <p className="hint">Sem categorias nesta coleção.</p>
          )}
          {rightCats.map((cat) => {
            const catCount = (linksByCategory.get(cat.id) || []).length
            const isFav = favoriteCats.some((c) => c.id === cat.id)
            return (
              <div
                key={cat.id}
                className={`side-item${cat.id === activeCategory?.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveCategoryId(cat.id === activeCategory?.id ? null : cat.id)
                  setDrawerRightOpen(false)
                }}
              >
                <span className="side-name">
                  <span
                    className="swatch"
                    style={{
                      background: `color-mix(in srgb, ${cat.color} 28%, transparent)`,
                      boxShadow: `inset 0 0 0 1px ${cat.color}40`,
                    }}
                  />
                  {cat.name}
                </span>
                <span className="side-right">
                  {isAdmin && (
                    <button
                      className={`icon-btn fav-star${isFav ? ' on' : ''}`}
                      title={
                        isFav
                          ? 'Remover dos favoritos'
                          : 'Adicionar aos favoritos'
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(cat)
                      }}
                    >
                      {isFav ? '★' : '☆'}
                    </button>
                  )}
                  {isAdmin && catCount === 0 && (
                    <button
                      className="icon-btn danger"
                      title="Remover"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!window.confirm(`Apagar a categoria "${cat.name}"?`)) return
                        deleteCategory(cat.id)
                          .then(() => flash(`Categoria "${cat.name}" apagada.`))
                          .catch(() => flash('Não deu para apagar a categoria.'))
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <span className="count">{catCount}</span>
                </span>
              </div>
            )
          })}
          {isAdmin && (
            <button
              className="btn ghost side-new"
              onClick={() => {
                const name = window.prompt('Nome da categoria:')
                if (!name || !name.trim()) return
                addCategory(activeCollection.id, name.trim())
                  .then(() => flash(`Categoria "${name.trim()}" criada.`))
                  .catch(() => flash('Não deu para criar a categoria.'))
              }}
            >
              + Nova categoria
            </button>
          )}
        </aside>
      </div>

      {modal && (
        <BookmarkModal
          bookmark={modal.bookmark}
          defaultCategoryId={modal.defaultCategoryId}
          onSave={handleSaveBookmark}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default App
