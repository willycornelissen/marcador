# Reversa Agents — opencode

Agentes do **Reversa** (Framework de Engenharia Reversa) instalados em `.agents/skills/`.

O Reversa é um framework de engenharia reversa que descobre, documenta e especifica sistemas legados em artefatos executáveis por agentes de IA. Escreve apenas em `.reversa/`, `_reversa_sdd/`, `_reversa_docs/`, `_reversa_forward/` e `_reversa_bugs/` — nunca modifica arquivos pré-existentes do projeto legado.

| Skill | Descrição |
|-------|-----------|
| **reversa** | Ponto de entrada principal. Orquestra a análise completa de um sistema legado, gerando especificações executáveis. Primeiro skill a ser chamado em qualquer sessão. |
| **reversa-scout** | Mapeia a superfície do projeto legado — estrutura de pastas, linguagens, frameworks, dependências e entry points. Inventário inicial da análise. |
| **reversa-archaeologist** | Analisa o código módulo a módulo — extrai algoritmos, fluxos de controle, estruturas de dados e dicionário de dados. Fase de escavação, após o scout. |
| **reversa-data-master** | Documenta o banco de dados — tabelas, relacionamentos, constraints, triggers, procedures e ERD completo. Usa DDL, migrations, ORM ou acesso ao banco. |
| **reversa-visor** | Documenta a interface do legado a partir de screenshots — componentes, layouts, fluxos de navegação e estados de tela. Sem necessidade de o sistema estar em execução. |
| **reversa-design-system** | Extrai e documenta o sistema de design do legado — paleta de cores, tipografia, espaçamentos, tokens e componentes a partir de CSS, temas e screenshots. |
| **reversa-detective** | Extrai conhecimento de negócio implícito — regras de negócio, ADRs retroativos via Git, máquinas de estado e matriz de permissões. Fase de interpretação. |
| **reversa-architect** | Sintetiza a análise em documentação arquitetural completa — diagramas C4, ERD completo, mapa de integrações e Spec Impact Matrix. Fase de interpretação, após o detective. |
| **reversa-writer** | Gera especificações executáveis como contratos operacionais, em pasta-por-unit com requirements.md, design.md e tasks.md. Fase de geração. |
| **reversa-reviewer** | Revisa criticamente as especificações do writer — encontra inconsistências, reclassifica confiança e gera perguntas para validação humana. |
| **reversa-forward** | Orquestrador do ciclo forward: detecta o estágio da feature ativa em `_reversa_forward/` e roteia para o próximo agente (requirements, clarify, plan, to-do, audit, quality, coding, sync). |
| **reversa-requirements** | Transforma uma ideia em documento de requisitos completo, ancorado nos artefatos da pipeline. Primeiro skill do ciclo forward. |
| **reversa-clarify** | Gera até cinco perguntas dirigidas para resolver pontos ambíguos do requirements e integra as respostas. Entre requirements e plan. |
| **reversa-plan** | Esboça a abordagem técnica como delta sobre o legado — roadmap, investigation, data-delta, onboarding e interfaces da feature ativa. |
| **reversa-to-do** | Decompõe o roadmap em ações atômicas com IDs sequenciais, dependências e marcador de paralelismo. |
| **reversa-audit** | Auditoria leitora estrita. Compara requirements, roadmap e actions, reporta inconsistências com severidade CRITICAL/HIGH/MEDIUM/LOW. Jamais altera os artefatos. |
| **reversa-quality** | Auditoria de clareza textual do requirements — se a prosa gera plano sem ambiguidade. Não confundir com auditoria de testes. |
| **reversa-coding** | Executa o actions.md em código: marca checkboxes [X], escreve progress.jsonl e gera legacy-impact.md e regression-watch.md. Último passo do ciclo forward. |
| **reversa-sync** | Convergência pós-coding: destila a feature entregue num adendo em `_reversa_sdd/addenda/`, mantendo a extração representativa entre re-extrações. |
| **reversa-resume** | Retoma uma feature pausada (paused-features de active-requirements.json) e a torna ativa. |
| **reversa-new** | Orquestrador greenfield: da ideia em linguagem natural a brainstorm, personas, PRD e specs SDD. Modos guiado e expresso. |
| **reversa-ideator** | Agente do time Code New Project. Conduz brainstorm estruturado com 6 perguntas divergentes. Produz `_reversa_sdd/ideation.md`. |
| **reversa-researcher** | Agente do time Code New Project. Aprofunda o público-alvo em 1 a 3 personas estruturadas. Produz `_reversa_sdd/personas.md`. |
| **reversa-drafter** | Agente do time Code New Project. Sintetiza ideation + personas em PRD completo. Produz `_reversa_sdd/prd.md`. |
| **reversa-spec-sdd** | Agente final do time Code New Project: decompõe o PRD em componentes e gera specs SDD com score de qualidade (0–100) e análise de gaps. Handoff para /reversa-forward. |
| **reversa-migrate** | Orquestrador do Time de Migração. Coleta brief e invoca os 6 agentes (Paradigm Advisor → Curator → Strategist → Designer → Screen Translator → Inspector), com pausas humanas. |
| **reversa-paradigm-advisor** | Primeiro agente do Time de Migração. Detecta o paradigma do legado, infere o paradigma natural da stack alvo e força decisão consciente. Produz paradigm_decision.md. |
| **reversa-curator** | Segundo agente do Time de Migração. Decide o que migra, o que descarta e o que precisa de decisão humana. Produz target_business_rules.md e discard_log.md. |
| **reversa-strategist** | Terceiro agente do Time de Migração. Propõe estratégias de migração com trade-offs, recomenda mas deixa a escolha como decisão humana. Produz migration_strategy.md, risk_register.md, cutover_plan.md. |
| **reversa-designer** | Quarto agente do Time de Migração. Fase 1: detecta topologia e propõe alternativa moderna (topology_decision.md). Fase 2: desenha specs do sistema novo com rastreabilidade. |
| **reversa-screen-translator** | Quinto agente do Time de Migração. Fase 1: detecta plataforma origem/alvo e exige decisão (literal/modernizado/híbrido). Fase 2: gera specs das telas (target_screens.md, deviation log). |
| **reversa-inspector** | Sexto agente do Time de Migração. Define como provar equivalência comportamental. Produz parity_specs.md e parity_tests/*.feature em Gherkin. |
| **reversa-docs** | Orquestrador do Time Reversa Docs. Gera mini-site HTML em `_reversa_docs/` com arquitetura 3D, dashboards, glossário, deck e páginas por feature. |
| **reversa-docs-analyst** | Analista do Time Docs. Páginas de dados quantitativos: dashboard Highcharts (treemap LOC, barras complexidade, sankey, histograma) e timeline interativa. |
| **reversa-docs-mapper** | Mapeador do Time Docs. Páginas de estrutura espacial: arquitetura 3D (Code City/Three.js), module map 2D (D3) e topologia side-by-side. |
| **reversa-docs-storyteller** | Narrador do Time Docs. Glossário interativo, slide deck navegável (6–10 slides) e páginas por feature em padrão How a Feature Works. |
| **reversa-docs-publisher** | Editor-chefe do Time Docs. Gera index.html com hero e selo, injeta mini-selo, faz auto-discovery de HTMLs e valida links. |
| **reversa-reconstructor** | Gera plano de reconstrução bottom-up a partir das specs e executa cada tarefa sob demanda, uma por vez, preservando tokens. |
| **reversa-refactor** | Orquestrador do time Code Quality. Inventaria oportunidades de melhoria, prioriza por ROI real (hotpath) e roteia para o especialista. Nunca aplica transformação. |
| **reversa-modularize** | Divide trecho grande em módulos coesos respeitando as fronteiras da alma. Não mexe na lógica interna nem inverte dependências. |
| **reversa-decouple** | Reduz dependências diretas (inversão, seams do Feathers, quebra de ciclo), com acoplamento medido antes/depois. |
| **reversa-restructure** | Refatoração de estrutura interna (método/classe) via catálogo Fowler, em passos pequenos e reversíveis, preservando comportamento. |
| **reversa-simplify** | Simplificação algorítmica: troca lógica complexa por solução mais clara, sem mudar o resultado, com prova de equivalência. |
| **reversa-optimize** | Otimização de desempenho: reduz tempo/memória/recursos com medição antes/depois, preservando a saída. Rejeita otimização prematura. |
| **reversa-standardize** | Aplica convenções de nomenclatura, formatação e organização do padrão dominante do projeto, sem mudar semântica. |
| **reversa-prune** | Remove código morto provado (sem referência estática nem entrada dinâmica), distinguindo morto de órfão suspeito. Reversível pelo diff. |
| **reversa-debugger** | Registrador de bugs: intake, triagem, dedupe, classificação e rastreabilidade SPEC↔CODE↔TEST↔BUG em `_reversa_bugs/<contexto>/`. Nunca corrige. |
| **reversa-debugger-fix** | Corretor de bugs: reproduz, investiga causa raiz, oferece debate opt-in, cria testes de reprodução/regressão, aplica change set em dois gates. |
| **reversa-debugger-debate** | Debate multiagente do time Bugs: N solvers em R rodadas com juiz isolado, para diagnóstico, correção ou veredito de spec. Sempre opt-in. |
| **reversa-debugger-graph** | Gerador de views do time Bugs: varre os bug.md, valida invariantes e regenera índice, catálogo, matriz BUG↔BUG, grafo mermaid e matriz BUG↔SPEC. |
| **reversa-depth-inspection** | Pente-fino do time Bugs: mapeia spec→código→testes→dados e varre com lentes especializadas em paralelo. Só diagnostica. |
| **reversa-agents-help** | Explica com analogias o que cada agente do Reversa faz e quando usá-lo. Ative com /reversa-agents-help. |
| **reversa-principles** | Cria ou atualiza os princípios duradouros do projeto e propaga ajustes nos templates dependentes. |
| **reversa-pricing-profile** | Entrevista guiada que gera o perfil de cobrança: país, moeda, senioridade, taxa hora, markup, regime tributário, modelo de cobrança. |
| **reversa-pricing-size** | Mede o tamanho estrutural da feature ativa e gera size.json/size.md com T-shirt sizing determinístico. |
| **reversa-pricing-estimate** | Combina profile e size para três cenários de preço: Esforço, Valor e Faixa de Mercado. |
| **reversa-autonomous** | Modo autônomo: roda a sequência completa do /reversa de ponta a ponta sem paradas, concentrando perguntas numa entrevista única. |
| **reversa-arquitetura-3d** | Visualizações 3D interativas de arquitetura (Three.js) — HTML standalone navegável por câmera livre a partir de JSON de módulos e dependências. |
| **reversa-especialista-d3** | Engenheiro de visualização D3.js (v7+): HTML standalone com force-directed, hierárquicos, sankey e treemap. |
| **reversa-highcharts-visualizer** | Visualizações interativas com Highcharts.js: HTML standalone com linhas, barras, pizza, heatmap, treemap, sankey, gantt. |
| **reversa-selo-generativo** | Cria selos visuais generativos seeded com p5.js — arte algorítmica reprodutível derivada de hash ou string. |
| **reversa-image-prompt-json** | Cria prompts JSON estruturados para geração de imagens com estética luxuosa e cinematográfica (produto, comida, cosmético, joia, moda). |

## Uso

As skills são carregadas sob demanda pelo opencode. O fluxo completo do Reversa:

```
reversa → scout → archaeologist → data-master → visor → detective → architect → writer → reviewer
```

Fluxo greenfield: `reversa-new` (→ ideator → researcher → drafter → spec-sdd).
Ciclo forward: `reversa-forward` (→ requirements → clarify → plan → to-do → audit → quality → coding → sync).
Migração: `reversa-migrate` (→ paradigm-advisor → curator → strategist → designer → screen-translator → inspector).
Docs: `reversa-docs` (→ analyst → mapper → storyteller → publisher).
