# Verification Reference

Detection commands, compliance checklists, and maturity assessment framework.

---

# Section 1: Modular Compliance

Run these commands to detect modular violations. **Never skip — they reveal hidden issues.**

## State Isolation (Principle 8) — Run First

```bash
# 1. Duplicate @Entity names (MOST CRITICAL — run this first)
grep -r "@Entity.*name:" package/ | grep -o "name: '[^']*'" | sort | uniq -d

# 2. Which modules have duplicates
grep -r "@Entity.*name:" package/ | \
  sed "s/.*package\/\([^/]*\)\/.*@Entity.*name: *['\"\(]\([^'\"]*\)['\"\)].*/\1:\2/" | \
  sort | awk -F: '{if($2==prev){print "❌ DUPLICATE: " $2 " in " prevmod " and " $1} prevmod=$1; prev=$2}'

# 3. Cross-module entity imports
grep -r "from.*@tlc.*/.*entity" package/ | grep -v shared

# 4. Shared database configurations (non-env-variable)
grep -r "host.*database.*username" package/ | grep -v "process.env.*_DATABASE_" | head -5

# 5. Each persistence module has named connection
for module in package/*/shared/persistence/*-persistence.module.ts; do
  if ! grep -q "name: '[a-z]*'" "$module"; then echo "❌ Missing named connection in $module"; fi
done
```

**Expected for all state isolation checks**: Empty output (no violations)

## Subdomain Persistence Ownership (Subdomain-Based Modules)

```bash
# 1. Shared persistence module exporting repositories (VIOLATION)
rg "exports:.*Repository" package/*/shared/persistence/*.module.ts

# 2. Subdomain services importing from shared persistence repos
rg "from.*shared/persistence/repository" package/*/*/

# 3. Cross-subdomain direct aggregate imports
rg "from.*\.\./\.\./(?!shared)" package/*/*/*.service.ts

# 4. Queue contract types defined inside a subdomain (should be in shared/contract/)
rg "export interface.*JobData" package/*/*/
```

**Expected**: Empty output for checks 1–3. Check 4 shows contracts only in `shared/contract/`.

## Controller Pattern Violations

```bash
# Controllers/resolvers with repository injections
grep -r "Repository" package/*/*/*.controller.ts package/*/*/*.resolver.ts 2>/dev/null

# Long controller methods (>30 lines) — sample check
find package -name "*.controller.ts" -not -path "*/__test__/*" | head -5 | xargs wc -l
```

## Transaction Management

```bash
# Write operations without @Transactional (sample)
grep -rl "\.save\|\.create\|\.update\|\.delete" package/ --include="*.service.ts" | head -5 | xargs grep -L "@Transactional" 2>/dev/null

# @Transactional without connectionName
grep -r "@Transactional()" package/
```

## Repository Pattern Compliance

```bash
# Repositories extending TypeORM Repository directly (violation)
grep -r "extends Repository" package/ --include="*.repository.ts"

# Missing named DataSource injection
find package -name "*.repository.ts" -not -path "*/shared/*" | xargs grep -L "@InjectDataSource" 2>/dev/null

# Services with TypeORM imports (ORM leakage)
grep -r "from 'typeorm'" package/ --include="*.service.ts" | grep -v "typeorm-transactional"
```

## Observability (Principle 9)

```bash
# Hardcoded API keys (CRITICAL security issue)
grep -r "apiKey.*=.*['\"]" package/ --exclude-dir=node_modules

# Check for circuit breaker usage
grep -r "CircuitBreaker" package/
```

## Boundary Violations (Principle 1)

```bash
# Internal services exported in index.ts
grep -r "export.*Service\|export.*Repository" package/*/index.ts
```

---

# Section 2: Structural Compliance

Run `yarn lint:structure` first — it covers forbidden folders, depth, README-in-aggregate, and single-file folders (warnings).

## Check 1: Depth

Business files must not exceed depth 2 (flat) or depth 3 (subdomain-based).

```bash
# Flat packages — services at depth 2
find package/billing package/identity package/recommendations \
  -name "*.service.ts" -not -path "*/shared/*" -not -path "*/__test__/*" | head -5

# Subdomain packages — entities at depth 3
find package/content package/analytics \
  -name "*.entity.ts" -not -path "*/shared/*" | head -5

# Automated depth + forbidden folder check
yarn lint:structure
```

**Expected**: All business files at correct depth; `lint:structure` exits 0.

## Check 2: Single-File Folder

Folders with only one file should use a suffix instead.

```bash
# lint:structure reports [single-file-folder] warnings
yarn lint:structure 2>&1 | grep "single-file-folder" || echo "✅ no single-file folders"
```

**Expected**: Zero warnings (or documented exceptions only).

## Check 3: Aggregate Size

Aggregates with ~15+ files signal review; ~25+ is a split candidate.

```bash
for pkg in billing identity content analytics recommendations; do
  for dir in package/$pkg/*/; do
    base=$(basename "$dir")
    [[ "$base" == "shared" || "$base" == "__test__" ]] && continue
    count=$(find "$dir" -maxdepth 1 -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
    [[ "$count" -ge 15 ]] && echo "⚠️  $dir: $count files"
  done
done
```

**Expected**: No aggregate ≥25 files without documented split plan.

## Check 4: Suffix vs Folder

Technical layer folders inside aggregates are violations.

```bash
# Forbidden legacy folders (should not exist in refactored packages)
find package -type d \( -name core -o -name http -o -name persistence -o -name public-api \) \
  -not -path "*/shared/*" -not -path "*/node_modules/*" 2>/dev/null

# Types/constants as folders (anti-pattern)
find package -type d \( -name types -o -name constants -o -name dto \) \
  -not -path "*/__test__/*" -not -path "*/node_modules/*" 2>/dev/null
```

**Expected**: Empty output (except `shared/persistence/` which is allowed).

## Check 5: README Inside Aggregate

No README files inside aggregate or subdomain business folders.

```bash
find package -path "*/shared/*" -prune -o -name "README.md" -print | \
  while read f; do
    depth=$(echo "$f" | tr -cd '/' | wc -c)
    [[ $depth -gt 2 ]] && echo "❌ README in aggregate: $f"
  done
```

**Expected**: Only package-root READMEs (e.g., `package/billing/README.md`).

---

# Section 3: Maturity Scoring

## Assessment Process

1. Run Section 1 (modular) and Section 2 (structural) commands
2. Score modular principles P1–P10 (1–10 each)
3. Score structural principles P11–P17 (1–10 each)
4. Apply weighted scoring: **70% modular + 30% structural**
5. Determine maturity level and generate recommendations

## Modular Scoring (70% weight)

| Principle | Weight | Notes |
|-----------|--------|-------|
| 1. Well-Defined Boundaries | 1.0 | |
| 2. Composability | 0.8 | |
| 3. Independence | 1.0 | |
| 4. Individual Scale | 0.6 | |
| 5. Explicit Communication | 1.0 | |
| 6. Replaceability | 0.8 | |
| 7. Deployment Independence | 0.7 | |
| 8. State Isolation ⚠️ | **1.5** | Highest modular weight |
| 9. Observability | 0.9 | |
| 10. Fail Independence | 0.9 | |

Modular subtotal: normalize to **70 points max**

## Structural Scoring (30% weight)

| Principle | Weight | Notes |
|-----------|--------|-------|
| 11. Co-location | 1.2 | |
| 12. Suffixes > Folders | 0.8 | |
| 13. Depth ≤ 2–3 | 1.2 | |
| 14. No Single-File Folders | 0.8 | |
| 15. Aggregate Limits | 0.6 | |
| 16. AI-Flat Optimization | 0.6 | |
| 17. No README in Aggregate | 0.4 | |

Structural subtotal: normalize to **30 points max**

**Total: 100 points** (70 modular + 30 structural)

## Maturity Level Definitions

| Level | Score | Characteristics |
|-------|-------|-----------------|
| **Immature** | 0–40 | Critical modular violations, legacy layer folders, multiple P0 issues |
| **Developing** | 41–65 | Some boundaries defined, structural migration incomplete |
| **Mature** | 66–85 | Strong modular + structural compliance, safe independent deployment |
| **Advanced** | 86–100 | Excellent compliance, flat-by-aggregate throughout, zero critical violations |

## Report Template

```markdown
# Modularity Maturity Assessment Report

**Assessment Date**: [Date]
**Codebase**: Fakeflix

## Executive Summary
- **Overall Maturity Level**: [Immature/Developing/Mature/Advanced]
- **Modular Score**: X/70
- **Structural Score**: X/30
- **Total**: X/100

## Modular Assessment (Section 1)
[Principle-by-principle with detection command output]

## Structural Assessment (Section 2)
[Depth, suffix, aggregate size, README checks]

## Recommendations by Priority
### P0 — Critical
### P1 — High
### P2 — Medium
```

---

# Section 4: Compliance Checklists

## New Feature Checklist

```
□ Identify correct module (doesn't cross bounded context)
□ Entity in aggregate folder with module-prefixed name
□ Repository in same aggregate folder
□ Service in same aggregate folder
□ Depth ≤2 (flat) or ≤3 (subdomain)
□ Suffixes used (no single-file folders)
□ No README inside aggregate
□ Controller/resolver is lean, injects services only
□ Write operations use @Transactional({ connectionName })
□ index.ts exports only facade and module class
□ yarn lint:structure passes
□ Run Section 1 detection commands (no violations)
```

## Pre-Commit Checklist

```
□ yarn lint:structure
□ grep -r "@Entity.*name:" package/ | grep -o "name: '[^']*'" | sort | uniq -d  (empty)
□ grep -r "from.*@tlc.*/.*entity" package/ | grep -v shared  (empty)
□ grep -r "@Transactional()" package/  (empty)
□ All unit tests pass
```

---

# Section 5: Automation

## CI Integration

Add to pipeline alongside `yarn lint:all`:

```yaml
- name: Structure Validation
  run: yarn lint:structure

- name: Check State Isolation
  run: |
    DUPLICATES=$(grep -r "@Entity.*name:" package/ | grep -o "name: '[^']*'" | sort | uniq -d)
    if [ ! -z "$DUPLICATES" ]; then echo "❌ Duplicate entity names"; exit 1; fi
```
