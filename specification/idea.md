# Idea Raw: Bookmark Manager (booky.io-style)

## Ideia original (verbatim)

Criação de um aplicativo web que gerencie a minha coleção de bookmarks.

- A ideia é fazer um aplicativo parecido com o booky.io.
- Só o administrador teria acesso e poderia criar, editar ou remover bookmarks.
- O aplicativo seria hospedado no Github Pages.
- Seria possível importar/exportar arquivos com o site booky.io.

## Decisões adicionais (exploração)

- **Banco de dados:** Firebase (Firestore + Auth) — definido pelo usuário.
- **Acesso:** leitura pública (qualquer pessoa vê), escrita exclusiva do admin.
  Replicar o padrão do projeto Estante
  (https://github.com/willycornelissen/estante).
- **Interface:** replicar a interface/estrutura do Estante (React + Vite,
  GitHub Pages, Firebase, tema dark estilo "galeria").
- **Stack (espelhando o Estante):** React + Vite, Firebase (Firestore + Auth),
  GitHub Pages via GitHub Actions.
- **Fidelidade ao booky.io:** espelho de features principais (categorias
  coloridas, busca, notas, favicons, tema claro/escuro, import/export HTML).
- **Estrutura do booky.io:** bookmarks agrupados em coleções, cada coleção com
  várias categorias. Um bookmark pode estar armazenado em coleções e categorias
  diferentes (relação many-to-many).
- **Persistência:** Firestore como fonte de verdade; localStorage dispensado
  (não é mais o armazenamento principal).

## Restrições explícitas

1. Aplicativo web (acessível via navegador).
2. Gerenciamento de coleção pessoal de bookmarks.
3. Semelhança com booky.io (referência de produto).
4. Leitura pública; CRUD (create, edit, remove) exclusivo do administrador.
5. Hospedagem em GitHub Pages.
6. Import/export de arquivos compatível com booky.io (formato Netscape HTML).
7. Banco de dados Firebase (Firestore + Auth).

## Perguntas em aberto (a explorar)

- Regras de segurança: leitura `true`, escrita restrita ao e-mail do admin.
- Modelo many-to-many decidido: coleções → categorias → bookmarks, com tabela
  de associação `bookmark_categories` (um bookmark pode estar em várias
  categorias/coleções).
