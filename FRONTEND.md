# Frontend Skills — opencode

Skills de desenvolvimento de frontend/design instaladas em `.opencode/skills/`.

Origem: repositório [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (pasta `.claude/skills/`) para `ui-ux-pro-max`, `design`, `ui-styling`, `design-system`, `brand`, `banner-design` e `slides`; marketplace [mrgoonie/claudekit-skills](https://github.com/mrgoonie/claudekit-skills) para `ai-multimodal`, `chrome-devtools` e `frontend-design`; [hotriluan/alkana_kpi](https://github.com/hotriluan/alkana_kpi) para `ai-artist`; e skill comunitária [claudskills.com](https://claudskills.com/skills/assets-organizing/) para `assets-organizing`.

Os scripts de cada skill são autocontidos (resolvem os próprios dados via caminhos relativos) e as invocações nos docs foram adaptadas de `${CLAUDE_PLUGIN_ROOT}/.claude/skills/` e `.claude/skills/` para `.opencode/skills/` (raiz do projeto).

| Skill | Descrição |
|-------|-----------|
| **ui-ux-pro-max** | Inteligência de design UI/UX para web e mobile. Banco de dados pesquisável: 84 estilos, 192 paletas, 74 pares de fontes, 98 guias de UX, 16 presets GSAP e 25 tipos de gráfico em 22 stacks. Busca via `scripts/search.py` com domínios `style`, `color`, `typography`, `chart`, `ux`, `landing`, `product`, `icons`, `gsap`, `react`, `web` e stacks (`react`, `nextjs`, `vue`, `svelte`, `flutter`, `swiftui`, `shadcn`, etc.). Suporta `--design-system` (recomendações completas com reasoning), `--persist` (MASTER.md + overrides por página) e dials `--variance/--motion/--density`. |
| **design** | Skill de design abrangente: logo (55 estilos, Gemini AI), programa de identidade corporativa (50 deliverables, mockups CIP), ícones SVG (15 estilos, Gemini 3.1 Pro), apresentações HTML (Chart.js), banners, fotos sociais e design system. Orquestra as sub-skills `brand`, `design-system` e `ui-styling`. |
| **ui-styling** | Cria UIs bonitas e acessíveis com shadcn/ui (Radix + Tailwind), utilitários Tailwind e design visual baseado em canvas. Usar ao construir interfaces, implementar design systems, layouts responsivos, componentes acessíveis (dialogs, dropdowns, forms, tables), temas, dark mode e geração de pôsteres/designs visuais. Inclui fontes em `canvas-fonts/`. |
| **design-system** | Arquitetura de tokens em três camadas (primitivo→semântico→componente), variáveis CSS, escalas de espaçamento/tipografia, specs de componentes e geração estratégica de slides. Scripts: `generate-tokens.cjs`, `validate-tokens.cjs`, `search-slides.py` (BM25), `slide-token-validator.py`. |
| **brand** | Identidade de marca: voz, identidade visual, frameworks de mensagem, gestão de ativos e consistência. Scripts: `inject-brand-context.cjs`, `validate-asset.cjs`, `extract-colors.cjs`, `sync-brand-to-tokens.cjs` (sync `docs/brand-guidelines.md` → tokens). |
| **banner-design** | Design de banners multi-formato para redes sociais, anúncios, hero de sites e impressão. 22 estilos de arte. Workflow: requisitos → direção de arte → HTML/CSS → export PNG. Orquestra as skills `frontend-design`, `ai-artist`, `ai-multimodal`, `chrome-devtools` e `assets-organizing`. |
| **ai-artist** | Geração de imagens Nano Banana (Gemini) com 129 prompts curados e 3 modos (search/creative/wild). Busca BM25 via `scripts/search.py` (domínios use-case, style, platform, technique, lighting) e geração via `scripts/generate.py`, roteando pelo `ai-multimodal`. Requer entrevista de validação e `GEMINI_API_KEY`. |
| **ai-multimodal** | Processa e gera mídia via Google Gemini API: transcrição de áudio, análise de imagem/vídeo, extração de documentos (PDF), geração de imagem (text-to-image, edição, composição). Scripts: `gemini_batch_process.py`, `document_converter.py`, `media_optimizer.py`. |
| **chrome-devtools** | Automação de browser, depuração e análise de performance com Puppeteer via CLI. Scripts Node: `screenshot.js`, `navigate.js`, `click.js`, `fill.js`, `network.js`, `performance.js`. Usado pelo `banner-design` para exportar banners em PNG. |
| **frontend-design** | Cria interfaces frontend de alta qualidade em HTML/CSS. Sem scripts; skill puramente instrutiva invocada pelo `banner-design` para compor os banners. |
| **assets-organizing** | Convenções de organização de outputs em `assets/` (banners, designs, reports, copy, etc.) por tópico, data e slug. Skill instrutiva usada para padronizar caminhos de saída. |
| **slides** | Cria apresentações HTML estratégicas com Chart.js, design tokens, layouts responsivos, fórmulas de copywriting e estratégias contextuais de slide. |

## Uso

As skills são carregadas sob demanda pelo opencode. Ao invocar uma skill, os scripts devem ser executados pelos caminhos `.opencode/skills/<skill>/scripts/...` a partir da raiz do projeto (ex.: `python .opencode/skills/ui-ux-pro-max/scripts/search.py "AI search tool" --domain style`).

## Requisitos

- **Python 3.x** para scripts `.py` (sem dependências externas para busca).
- **Virtualenv compartilhado** `.opencode/skills/.venv` com `google-genai`, `pypdf`, `markdown`, `python-dotenv`, `pillow`, `pytest` (see `ai-multimodal/scripts/requirements.txt`). Necessário para `ai-multimodal` e `ai-artist`.
- **Node.js** para scripts `.cjs` do `design` e para `chrome-devtools` (deps em `chrome-devtools/scripts/package.json`, instaladas via `npm install`).
- `design` (logo/CIP/ícones via Gemini) e `ai-artist`/`ai-multimodal` (geração de imagens) requerem `GEMINI_API_KEY` nas variáveis de ambiente ou em `.opencode/skills/ai-multimodal/.env`.

## Origem

- [`ui-ux-pro-max-skill/.claude/skills`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills) (MIT) — `ui-ux-pro-max`, `design`, `ui-styling`, `design-system`, `brand`, `banner-design`, `slides`.
- [`claudekit-skills/.claude/skills`](https://github.com/mrgoonie/claudekit-skills/tree/main/.claude/skills) — `ai-multimodal`, `chrome-devtools`, `frontend-design`.
- [`alkana_kpi/.claude/skills/ai-artist`](https://github.com/hotriluan/alkana_kpi/tree/main/.claude/skills/ai-artist) (MIT) — `ai-artist`.
- [`claudskills.com/skills/assets-organizing`](https://claudskills.com/skills/assets-organizing/) — `assets-organizing`.

Instalado em 2026-08-04.
