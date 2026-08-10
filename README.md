# Marcador

Gerenciador pessoal de bookmarks no estilo [booky.io](https://booky.io), espelhando a
arquitetura do [Estante](https://github.com/willycornelissen/estante):
React + Vite, Firebase (Firestore + Auth), GitHub Pages e import/export no formato
Netscape HTML.

- Leitura pública; escrita exclusiva do admin (`VITE_ADMIN_EMAIL`).
- Coleções → Categorias → Bookmarks, com o mesmo bookmark em várias categorias
  (relação many-to-many via `bookmark_categories`).
- Tema dark stone + âmbar.

## Estrutura

- `specification/` — idea, research, wireframe e mockup (HTML + PNGs).
- `booky_backup_2026-08-10.html` — backup do booky.io para popular a base.
- `src/` — app React (UI em `App.jsx`, dados em `src/lib/`).
- `scripts/seed-booky.mjs` — popula o Firestore a partir do backup.

## Setup

1. `npm install`
2. Crie um projeto Firebase (plano Spark):
   - **Authentication** → sign-in method → **Email/Senha** → crie o usuário admin.
   - **Firestore** → criar banco (modo produção).
3. `cp .env.example .env` e preencha com a config do seu app web
   (Console → Configurações do projeto → Seus apps → Config do SDK).
4. Deploy das regras do Firestore:
   `npx firebase-tools use <project-id> && npx firebase-tools deploy --only firestore`

## Popular a base

**Opção A — pelo app:** entre como admin (o e-mail definido em `VITE_ADMIN_EMAIL`)
e use **Importar HTML…** na sidebar, escolhendo `booky_backup_2026-08-10.html`.

**Opção B — seed em lote** (script em Node, sem login):

```bash
FIREBASE_PROJECT_ID=seu-projeto \
GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json \
npm run seed
```

Sem as credenciais, o script apenas imprime as estatísticas do backup.

## Deploy (GitHub Pages)

O workflow `.github/workflows/deploy.yml` publica em `https://willycornelissen.github.io/marcador/`
a cada push em `master`/`main`. Configure os secrets do repositório:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID`, `VITE_ADMIN_EMAIL`

E em **Settings → Pages** escolha a origem **GitHub Actions**.

## Schema Firestore

| Coleção | Campos |
| --- | --- |
| `collections` | `name`, `position`, `color?`, `uid`, `createdAt`, `updatedAt` |
| `categories` | `collectionId`, `name`, `position`, `color`, `uid`, `createdAt`, `updatedAt` |
| `bookmarks` | `name`, `url`, `note`, `favicon`, `uid`, `createdAt`, `updatedAt` |
| `bookmark_categories` | `bookmarkId`, `categoryId`, `position` |

## Scripts

- `npm run dev` — servidor local.
- `npm run build` — build de produção em `dist/`.
- `npm run lint` — oxlint.
- `npm run seed` — `scripts/seed-booky.mjs`.
