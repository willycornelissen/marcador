# Marcador

Gerenciador pessoal de bookmarks no estilo [booky.io](https://booky.io),
espelhando a arquitetura do [Estante](https://github.com/willycornelissen/estante):
React + Vite, Firebase (Firestore + Auth), deploy no GitHub Pages com domínio
próprio e import/export no formato Netscape HTML.

## Recursos

- **Leitura pública** — qualquer visitante vê o catálogo; só o admin escreve.
- **Coleções → Categorias → Bookmarks** — o mesmo bookmark pode aparecer em
  várias categorias (relação many-to-many sem duplicar dados).
- **Listagens em ordem alfabética** — coleções, categorias e bookmarks são
  ordenados por nome (ignorando maiúsculas e acentos).
- **Import/export Netscape** — migre de qualquer navegador ou do booky.io.
- **Tema claro e escuro** — botão no topo alterna entre os dois; a preferência é
  lembrada e o padrão segue o tema do sistema.
- **Domínio próprio** — publicado em `marcador.willy.dev.br`.

## Stack

- **Frontend:** React 19 + Vite.
- **Backend:** Firebase Firestore + Firebase Auth.
- **Deploy:** GitHub Actions → GitHub Pages + CNAME.
- **Seed:** Node (firebase-admin) a partir de um backup Netscape.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/` | App React (`App.jsx`) e lógica em `src/lib/` (firebase, bookmarks, auth, netscape, colors) |
| `specification/` | Idea, research, wireframes e mockups (HTML + PNG) |
| `scripts/seed-booky.mjs` | Popula o Firestore a partir de um backup Netscape |
| `public/` | `CNAME`, `favicon.svg` e `marcador.png` |
| `booky_backup_2026-08-10.html` | Backup do booky.io usado como base |
| `.github/workflows/deploy.yml` | Pipeline de build e deploy |

## Como rodar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Configure o Firebase (plano Spark):
   - **Authentication** → sign-in method → **E-mail/Senha** → crie o usuário
     admin.
   - **Firestore** → criar banco no modo produção.

3. Crie o `.env` a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

   Preencha com a config do seu app web (Console → Configurações do projeto →
   Seus apps → Config do SDK). O e-mail de admin é o valor de
   `VITE_ADMIN_EMAIL`; se vazio, o padrão é `willy.cornelissen@gmail.com`.

4. Deploy das regras do Firestore (o admin precisa ter o mesmo e-mail do
   `firestore.rules`):

   ```bash
   npx firebase-tools use <project-id>
   npx firebase-tools deploy --only firestore
   ```

5. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

> **Atenção:** não abra `dist/index.html` direto pelo sistema de arquivos
> (`file://`). Os módulos ES são bloqueados por CORS fora de HTTP. Use
> `npm run preview` ou um servidor local.

## Popular a base

**Opção A — pelo app:** entre como admin e use **Importar HTML…** na sidebar,
escolhendo `booky_backup_2026-08-10.html`.

**Opção B — seed em lote** (script em Node, sem login):

```bash
FIREBASE_PROJECT_ID=seu-projeto \
GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json \
npm run seed
```

Sem as credenciais, o script apenas imprime as estatísticas do backup.

## Build e preview

```bash
npm run build      # gera dist/
npm run preview    # serve o build localmente
```

O `vite.config.js` usa `base: './'` (caminho relativo), então o build funciona
em qualquer hospedagem — subpasta do GitHub Pages ou domínio próprio na raiz.

## Deploy (GitHub Pages)

O workflow `.github/workflows/deploy.yml` publica a cada push em `main`. Os
secrets do repositório são:

- `APIKEY`, `AUTHDOMAIN`, `PROJECTID`, `STORAGEBUCKET`, `MESSAGINGSENDERID` e
  `APPID` — valores da config do app web no Firebase.

O domínio próprio `marcador.willy.dev.br` é configurado pelo arquivo
`public/CNAME`. Se for usar sem CNAME, o site fica disponível em
`https://<usuario>.github.io/marcador/`.

## Schema Firestore

| Coleção | Campos |
| --- | --- |
| `collections` | `name`, `position`, `color?`, `uid`, `createdAt`, `updatedAt` |
| `categories` | `collectionId`, `name`, `position`, `color`, `uid`, `createdAt`, `updatedAt` |
| `bookmarks` | `name`, `url`, `note`, `favicon`, `uid`, `createdAt`, `updatedAt` |
| `bookmark_categories` | `bookmarkId`, `categoryId`, `position` |

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor local |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Preview do build |
| `npm run lint` | Oxlint em `src` e `scripts` |
| `npm run seed` | Seed do Firestore a partir do backup |
