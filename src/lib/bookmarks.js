import { auth, db } from './firebase'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

// Quatro coleções Firestore (espelhando o Estante + associação many-to-many):
//   collections        { name, position, color?, uid, createdAt, updatedAt }
//   categories         { collectionId, name, position, color, uid, createdAt, updatedAt }
//   bookmarks          { name, url, note, favicon, uid, createdAt, updatedAt }
//   bookmark_categories{ bookmarkId, categoryId, position }
//
// A associação é a fonte de verdade de "onde está cada bookmark": um bookmark
// pertence a uma coleção indiretamente, por estar em uma categoria daquela
// coleção. Isso permite o mesmo bookmark aparecer em várias coleções/categorias
// sem duplicar dados.

const collectionsCol = () => collection(db, 'collections')
const categoriesCol = () => collection(db, 'categories')
const bookmarksCol = () => collection(db, 'bookmarks')
const linksCol = () => collection(db, 'bookmark_categories')

function mapDocs(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Subscrição única a tudo: o app carrega o catálogo inteiro via onSnapshot e
// monta as relações em memória (o volume é pequeno, ~KB).
export function subscribeData(cb) {
  const unsubs = [
    onSnapshot(query(collectionsCol()), (s) =>
      cb((prev) => ({ ...prev, collections: mapDocs(s) }))
    ),
    onSnapshot(query(categoriesCol()), (s) =>
      cb((prev) => ({ ...prev, categories: mapDocs(s) }))
    ),
    onSnapshot(query(bookmarksCol()), (s) =>
      cb((prev) => ({ ...prev, bookmarks: mapDocs(s) }))
    ),
    onSnapshot(query(linksCol()), (s) =>
      cb((prev) => ({ ...prev, links: mapDocs(s) }))
    ),
  ]
  return () => unsubs.forEach((u) => u())
}

const uid = () => auth.currentUser?.uid ?? null
const ts = () => serverTimestamp()

function baseData(extra = {}) {
  return { uid: uid(), createdAt: ts(), updatedAt: ts(), ...extra }
}

// ---------------- Coleções ----------------

export async function addCollection(name, color = null) {
  const count = await countDocs(collectionsCol())
  await addDoc(collectionsCol(), baseData({ name, position: count, color }))
}

export async function deleteCollection(id) {
  // Remove a coleção, suas categorias e as associações das categorias.
  const catDocs = await snapshotWhere(categoriesCol(), 'collectionId', id)
  const catIds = catDocs.map((d) => d.id)
  const batch = writeBatch(db)
  batch.delete(doc(db, 'collections', id))
  catIds.forEach((cid) => batch.delete(doc(db, 'categories', cid)))
  if (catIds.length > 0) {
    const links = await snapshotWhereIn(linksCol(), 'categoryId', catIds)
    links.forEach((d) => batch.delete(doc(db, 'bookmark_categories', d.id)))
  }
  await batch.commit()
}

// Favoritas: lista de até 3 categorias por coleção, salva na própria coleção.
export async function updateCollectionFavorites(collectionId, favoriteCategoryIds) {
  await updateDoc(doc(db, 'collections', collectionId), {
    favoriteCategoryIds,
    updatedAt: serverTimestamp(),
  })
}

// ---------------- Categorias ----------------

export async function addCategory(collectionId, name, color = '#78716c') {
  const siblings = await snapshotWhere(
    categoriesCol(),
    'collectionId',
    collectionId
  )
  await addDoc(
    categoriesCol(),
    baseData({ collectionId, name, position: siblings.length, color })
  )
}

export async function deleteCategory(id) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'categories', id))
  const links = await snapshotWhere(linksCol(), 'categoryId', id)
  links.forEach((d) => batch.delete(doc(db, 'bookmark_categories', d.id)))
  await batch.commit()
}

// ---------------- Bookmarks ----------------

// Cria o bookmark e suas associações em um único batch (transação).
export async function addBookmark(data, categoryIds = []) {
  const { name, url, note, favicon } = data
  const batch = writeBatch(db)
  const bmRef = doc(collection(db, 'bookmarks'))
  batch.set(
    bmRef,
    baseData({ name, url, note: note || null, favicon: favicon || null })
  )
  categoryIds.forEach((cid, i) => {
    const linkRef = doc(collection(db, 'bookmark_categories'))
    batch.set(linkRef, { bookmarkId: bmRef.id, categoryId: cid, position: i })
  })
  await batch.commit()
  return bmRef.id
}

// Atualiza o bookmark e sincroniza a associação com as categorias atuais.
export async function updateBookmark(id, data, categoryIds = []) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'bookmarks', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
  const existing = await snapshotWhere(linksCol(), 'bookmarkId', id)
  existing.forEach((d) => batch.delete(doc(db, 'bookmark_categories', d.id)))
  categoryIds.forEach((cid, i) => {
    const linkRef = doc(collection(db, 'bookmark_categories'))
    batch.set(linkRef, { bookmarkId: id, categoryId: cid, position: i })
  })
  await batch.commit()
}

// Remove o bookmark e as associações (evita órfãos na tabela de ligação).
export async function deleteBookmark(id) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'bookmarks', id))
  const links = await snapshotWhere(linksCol(), 'bookmarkId', id)
  links.forEach((d) => batch.delete(doc(db, 'bookmark_categories', d.id)))
  await batch.commit()
}

// ---------------- Import em lote ----------------

// Grava um catálogo inteiro (coleções → categorias → bookmarks) em batches.
// `catalog` = [{ name, color?, categories: [{ name, color?, bookmarks: [...] }] }]
export async function importCatalog(catalog) {
  let batch = writeBatch(db)
  let ops = 0

  for (const [colIdx, col] of catalog.entries()) {
    const colRef = doc(collection(db, 'collections'))
    batch.set(
      colRef,
      baseData({ name: col.name, position: colIdx, color: col.color || null })
    )
    ops++
    let pos = 0
    for (const cat of col.categories || []) {
      const catRef = doc(collection(db, 'categories'))
      batch.set(
        catRef,
        baseData({
          collectionId: colRef.id,
          name: cat.name,
          position: pos++,
          color: cat.color || '#78716c',
        })
      )
      ops++
      for (const [i, bm] of (cat.bookmarks || []).entries()) {
        const bmRef = doc(collection(db, 'bookmarks'))
        batch.set(
          bmRef,
          baseData({
            name: bm.name,
            url: bm.url,
            note: bm.note || null,
            favicon: bm.favicon || null,
          })
        )
        const linkRef = doc(collection(db, 'bookmark_categories'))
        batch.set(linkRef, {
          bookmarkId: bmRef.id,
          categoryId: catRef.id,
          position: i,
        })
        ops++
      }
      // Firestore limita 500 operações por batch.
      if (ops >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        ops = 0
      }
    }
  }
  if (ops > 0) await batch.commit()
}

// ---------------- Helpers ----------------

async function countDocs(col) {
  const snap = await getDocs(col)
  return snap.size
}

async function snapshotWhere(col, field, value) {
  const snap = await getDocs(query(col, where(field, '==', value)))
  return snap.docs
}

async function snapshotWhereIn(col, field, values) {
  const snap = await getDocs(query(col, where(field, 'in', values)))
  return snap.docs
}
