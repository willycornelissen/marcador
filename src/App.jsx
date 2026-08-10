import { useEffect, useMemo, useState } from 'react'
import { auth } from './lib/firebase'
import { onAuthChange, signIn, signOut } from './lib/auth'
import {
  addBookmark,
  addCategory,
  addCollection,
  deleteBookmark,
  importCatalog,
  subscribeData,
  updateBookmark,
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

function BookmarkModal({
  bookmark,
  defaultCategoryId,
  categories,
  collections,
  onSave,
  onClose,
}) {
  const [name, setName] = useState(bookmark?.name || '')
  const [url, setUrl] = useState(bookmark?.url || '')
  const [note, setNote] = useState(bookmark?.note || '')
  const [selected, setSelected] = useState(
    () =>
      new Set(bookmark?.categoryIds || (defaultCategoryId ? [defaultCategoryId] : []))
  )
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => {
    const byCol = new Map()
    for (const cat of categories) {
      if (!byCol.has(cat.collectionId)) byCol.set(cat.collectionId, [])
      byCol.get(cat.collectionId).push(cat)
    }
    return [...byCol.entries()].map(([collectionId, cats]) => ({
      collection: collections.find((c) => c.id === collectionId),
      cats,
    }))
  }, [categories, collections])

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) {
      setError('Preencha nome e URL.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), url: url.trim(), note: note.trim() }, [
        ...selected,
      ])
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
        <div className="field">
          <label>Categorias</label>
          <div className="cat-pick">
            {groups.length === 0 && <p className="hint">Nenhuma categoria ainda.</p>}
            {groups.map(({ collection, cats }) => (
              <div className="cat-group" key={collection?.id || '?'}>
                {collection && <div className="cat-group-name">{collection.name}</div>}
                {cats.map((cat) => (
                  <label className="cat-opt" key={cat.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(cat.id)}
                      onChange={() => toggle(cat.id)}
                    />
                    <span className="dot" style={{ background: cat.color }} />
                    {cat.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
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
      a.download = 'marcador.html'
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

function CategoryCard({
  cat,
  bookmarks,
  onAddBookmark,
  onEditBookmark,
  onDeleteBookmark,
}) {
  return (
    <section className="cat-card">
      <div className="cat-head">
        <div className="cat-name">
          <span className="dot" style={{ background: cat.color }} />
          {cat.name}
        </div>
        <div className="cat-count">{bookmarks.length}</div>
      </div>
      {bookmarks.length === 0 && <div className="cat-empty">Sem bookmarks.</div>}
      {bookmarks.map((bm) => (
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
          <div className="bm-actions">
            <button
              className="icon-btn"
              title="Editar"
              onClick={() => onEditBookmark(bm, cat.id)}
            >
              ✎
            </button>
            <button
              className="icon-btn danger"
              title="Remover"
              onClick={() => onDeleteBookmark(bm, cat.id)}
            >
              ✕
            </button>
          </div>
        </article>
      ))}
      <button className="btn ghost mini" onClick={() => onAddBookmark(cat.id)}>
        + Bookmark
      </button>
    </section>
  )
}

function CollectionView({
  collection,
  categories,
  linksByCategory,
  bookmarksById,
  onAddCategory,
  onAddBookmark,
  onEditBookmark,
  onDeleteBookmark,
}) {
  const colCats = categories.filter((c) => c.collectionId === collection.id)
  if (colCats.length === 0) {
    return (
      <div className="cats">
        <div className="cat-empty">
          Nenhuma categoria ainda. Crie a primeira.
        </div>
      </div>
    )
  }
  return (
    <div className="cats">
      {colCats.map((cat) => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          bookmarks={(linksByCategory.get(cat.id) || [])
            .map((id) => bookmarksById.get(id))
            .filter(Boolean)}
          onAddBookmark={onAddBookmark}
          onEditBookmark={onEditBookmark}
          onDeleteBookmark={onDeleteBookmark}
        />
      ))}
      <button className="btn ghost mini" onClick={onAddCategory}>
        + Categoria
      </button>
    </div>
  )
}

function SearchResults({ results, onEdit, onDelete }) {
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
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState(null)

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    setFirebaseReady(!!auth)
  }, [])

  useEffect(() => {
    if (!auth) return
    return subscribeData((update) => {
      setCollections((prev) => update(prev).collections)
    })
  }, [])

  useEffect(() => {
    if (!auth) return
    return subscribeData((update) => {
      setCategories((prev) => update(prev).categories)
    })
  }, [])

  useEffect(() => {
    if (!auth) return
    return subscribeData((update) => {
      setBookmarks((prev) => update(prev).bookmarks)
    })
  }, [])

  useEffect(() => {
    if (!auth) return
    return subscribeData((update) => {
      setLinks((prev) => update(prev).links)
    })
  }, [])

  useEffect(() => {
    if (!auth) return
    return onAuthChange((u) => {
      setUser(u)
      setShowLogin(false)
    })
  }, [])

  useEffect(() => {
    if (activeCollectionId && !collections.some((c) => c.id === activeCollectionId)) {
      setActiveCollectionId(collections[0]?.id || null)
    }
  }, [collections, activeCollectionId])

  function flash(message) {
    setNotice(message)
    setTimeout(() => setNotice(null), 5000)
  }

  const activeCollection =
    collections.find((c) => c.id === activeCollectionId) || collections[0] || null

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

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return bookmarks.filter(
      (bm) =>
        bm.name.toLowerCase().includes(q) ||
        bm.url.toLowerCase().includes(q) ||
        (bm.note || '').toLowerCase().includes(q)
    )
  }, [search, bookmarks])

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

  function handleAddCollection() {
    const name = window.prompt('Nome da coleção:')
    if (!name || !name.trim()) return
    addCollection(name.trim())
      .then(() => flash(`Coleção "${name.trim()}" criada.`))
      .catch(() => flash('Não deu para criar a coleção.'))
  }

  return (
    <div className="app">
      {notice && <div className="notice bar">{notice}</div>}
      <header className="header">
        <button className="hamb" onClick={() => setDrawerOpen((v) => !v)}>
          <span />
          <span />
        </button>
        <a className="logo" href="#">
          Marcador<span className="dot">.</span>
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
          {isAdmin && (
            <button
              className="btn primary"
              onClick={() => setModal({})}
            >
              <span className="label-lg">Adicionar bookmark</span>＋
            </button>
          )}
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

      <div className="body">
        <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
          <div className="side-label">Coleções</div>
          {collections.map((col) => (
            <div
              key={col.id}
              className={`side-item${col.id === activeCollection?.id ? ' active' : ''}`}
              onClick={() => {
                setActiveCollectionId(col.id)
                setDrawerOpen(false)
              }}
            >
              <span className="side-name">
                <span className="dot" style={{ background: col.color }} />
                {' '}
                {col.name}
              </span>
              <span className="count">
                {countBookmarksFor(col.id, categories)}
              </span>
            </div>
          ))}
          {isAdmin && (
            <>
              <button className="btn ghost side-new" onClick={handleAddCollection}>
                + Nova coleção
              </button>
              <div className="side-label" style={{ marginTop: 16 }}>
                Categorias de {activeCollection?.name}
              </div>
              <div className="side-sub">
                {categories
                  .filter((c) => c.collectionId === activeCollection?.id)
                  .map((cat) => (
                    <div className="side-item sub" key={cat.id}>
                      <span className="dot" style={{ background: cat.color }} />
                      <span className="side-name">{cat.name}</span>
                    </div>
                  ))}
              </div>
              <ImportExport
                catalog={collections}
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
          ) : activeCollection ? (
            <CollectionView
              collection={activeCollection}
              categories={categories}
              linksByCategory={linksByCategory}
              bookmarksById={bookmarksById}
              onAddCategory={() => {
                const name = window.prompt('Nome da categoria:')
                if (!name || !name.trim()) return
                addCategory(activeCollection.id, name.trim())
                  .then(() => flash(`Categoria "${name.trim()}" criada.`))
                  .catch(() => flash('Não deu para criar a categoria.'))
              }}
              onAddBookmark={(defaultCategoryId) => setModal({ defaultCategoryId })}
              onEditBookmark={(bm, defaultCategoryId) =>
                setModal({
                  bookmark: {
                    ...bm,
                    categoryIds: categoriesByBookmark.get(bm.id) || [],
                  },
                  defaultCategoryId,
                })
              }
              onDeleteBookmark={(bm, catId) => {
                if (!window.confirm(`Apagar "${bm.name}"?`)) return
                deleteBookmark(bm.id, catId)
                  .then(() => flash('Bookmark apagado.'))
                  .catch(() => flash('Não deu para apagar.'))
              }}
            />
          ) : (
            <p className="hint">Nenhuma coleção ainda.</p>
          )}

          {showLogin && !user && firebaseReady && (
            <LoginForm onMessage={flash} />
          )}
        </main>
      </div>

      {modal && (
        <BookmarkModal
          bookmark={modal.bookmark}
          defaultCategoryId={modal.defaultCategoryId}
          categories={categories}
          collections={collections}
          onSave={handleSaveBookmark}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default App
