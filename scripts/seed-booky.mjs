#!/usr/bin/env node
// Seed do Firestore a partir de um backup Netscape (booky.io).
//
// Só estatísticas (sem credenciais):
//   node scripts/seed-booky.mjs
//
// Grava no Firestore (requer service account do Firebase com permissão de
// escrita no Firestore):
//   FIREBASE_PROJECT_ID=seu-projeto \
//   GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json \
//   node scripts/seed-booky.mjs [caminho/do/backup.html]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNetscape } from '../src/lib/netscape.js'
import { colorFor } from '../src/lib/colors.js'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const here = path.dirname(fileURLToPath(import.meta.url))
const backupPath =
  process.argv[2] || path.resolve(here, '..', 'booky_backup_2026-08-10.html')

const catalog = parseNetscape(readFileSync(backupPath, 'utf-8'))

const stats = catalog.reduce(
  (acc, col) => {
    acc.collections += 1
    acc.categories += (col.categories || []).length
    acc.bookmarks += (col.categories || []).reduce(
      (n, cat) => n + (cat.bookmarks || []).length,
      0
    )
    return acc
  },
  { collections: 0, categories: 0, bookmarks: 0 }
)

console.log(`Backup: ${backupPath}`)
console.log(`Coleções: ${stats.collections}`)
console.log(`Categorias: ${stats.categories}`)
console.log(`Bookmarks: ${stats.bookmarks}`)

const projectId = process.env.FIREBASE_PROJECT_ID
if (!projectId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('\nSem FIREBASE_PROJECT_ID/GOOGLE_APPLICATION_CREDENTIALS — apenas estatísticas.')
  process.exit(0)
}

initializeApp({ projectId, credential: applicationDefault() })
const db = getFirestore()
const now = FieldValue.serverTimestamp()

let batch = db.batch()
let ops = 0

async function flush() {
  if (ops === 0) return
  await batch.commit()
  batch = db.batch()
  ops = 0
}

for (const [colIdx, col] of catalog.entries()) {
  if ((col.categories || []).length === 0) continue
  const colRef = db.collection('collections').doc()
  batch.set(colRef, {
    name: col.name,
    position: colIdx,
    color: colorFor(col.name),
    uid: null,
    createdAt: now,
    updatedAt: now,
  })
  ops++
  for (const [catIdx, cat] of (col.categories || []).entries()) {
    const catRef = db.collection('categories').doc()
    batch.set(catRef, {
      collectionId: colRef.id,
      name: cat.name,
      position: catIdx,
      color: colorFor(cat.name),
      uid: null,
      createdAt: now,
      updatedAt: now,
    })
    ops++
    for (const [bmIdx, bm] of (cat.bookmarks || []).entries()) {
      const bmRef = db.collection('bookmarks').doc()
      batch.set(bmRef, {
        name: bm.name,
        url: bm.url,
        note: bm.note || null,
        favicon: null,
        uid: null,
        createdAt: now,
        updatedAt: now,
      })
      const linkRef = db.collection('bookmark_categories').doc()
      batch.set(linkRef, {
        bookmarkId: bmRef.id,
        categoryId: catRef.id,
        position: bmIdx,
      })
      ops++
      // Firestore limita 500 operações por batch.
      if (ops >= 400) await flush()
    }
  }
}
await flush()
console.log(`\nGravado com sucesso no projeto ${projectId}.`)
