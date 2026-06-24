# Supplier Lineup Compare — Restore Header/Total Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert the card-strip summary (shipped in commit `69aba3b`) back to an in-table lineup-name header row and Total row, but give the restored Total row a highlighted background and bold values so it stands out from the plain category rows below it.

**Architecture:** Single-file change to `app/more/supplier-lineup/compare/page.tsx`. Remove the card-strip block; restore the table's header `<tr>` and a Total `<tr>` directly inside `<tbody>`; style the Total row with `bg-terra-100` and `font-bold`. The now-unneeded React Fragment wrapper collapses back to a single `<div>` branch.

**Tech Stack:** React (client component), Tailwind CSS. No test runner exists in this project — verification is `npx tsc --noEmit`, `npm run build`, and a manual review of the JSX.

## Global Constraints

- This change touches only `app/more/supplier-lineup/compare/page.tsx`.
- The widened desktop container (`lg:max-w-5xl`) and the price-free `cellLabel` (vendor name only, no price) from commit `69aba3b` are NOT reverted — they stay as-is.
- `totalLabel`'s computation logic is unchanged — only where/how its output is rendered changes.
- GPG signing always disabled for commits: `git -c commit.gpgsign=false commit`.

---

### Task 1: Remove the card strip, restore header row and a bold/highlighted Total row

**Files:**
- Modify: `app/more/supplier-lineup/compare/page.tsx`

**Interfaces:** None — this is the only file in scope.

- [ ] **Step 1: Replace the card strip + table with the restored table structure**

Find:

```tsx
            <>
              <div className="flex gap-3 overflow-x-auto pb-1 mb-3">
                <div className="w-28 flex-shrink-0" />
                {lineups.map((l) => (
                  <div key={l.id} className="min-w-40 flex-shrink-0 bg-terra-100 rounded-xl px-4 py-3">
                    <Link href={`/more/supplier-lineup/${l.id}`} className="text-sm font-semibold text-accent hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-base font-bold mt-0.5">{totalLabel(l.id)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm border-collapse">
                  <tbody>
                    {activeCategories.map((cat) => (
                      <tr key={cat}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          {CATEGORY_LABELS[cat]}
                        </td>
                        {lineups.map((l) => (
                          <td key={l.id} className="px-3 py-2 border-b border-border border-l border-border whitespace-nowrap">
                            {cellLabel(l.id, cat)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
```

Replace with:

```tsx
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm border-collapse">
                <tbody>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border w-28 min-w-28">
                      &nbsp;
                    </th>
                    {lineups.map((l) => (
                      <th
                        key={l.id}
                        className="px-3 py-2 text-left font-medium border-b border-border border-l border-border min-w-40 whitespace-nowrap"
                      >
                        <Link href={`/more/supplier-lineup/${l.id}`} className="text-accent hover:underline">
                          {l.name}
                        </Link>
                      </th>
                    ))}
                  </tr>

                  <tr className="bg-terra-100">
                    <td className="sticky left-0 z-10 bg-terra-100 px-3 py-2 text-xs font-bold text-muted-fg border-b border-border">
                      Total
                    </td>
                    {lineups.map((l) => (
                      <td key={l.id} className="px-3 py-2 text-sm font-bold border-b border-border border-l border-border whitespace-nowrap">
                        {totalLabel(l.id)}
                      </td>
                    ))}
                  </tr>

                  {activeCategories.map((cat) => (
                    <tr key={cat}>
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                        {CATEGORY_LABELS[cat]}
                      </td>
                      {lineups.map((l) => (
                        <td key={l.id} className="px-3 py-2 border-b border-border border-l border-border whitespace-nowrap">
                          {cellLabel(l.id, cat)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `rm -rf .next && npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 4: Manual review**

With at least 2 saved lineups:
1. Confirm the table's first row again shows each lineup's name as a link (no card strip above the table anymore).
2. Confirm the second row is "Total" with a highlighted (`bg-terra-100`) background spanning the sticky label cell and every lineup column, with bold text in every cell of that row.
3. Confirm category rows below are unchanged (plain background, vendor name only, no price).
4. Confirm the page is still widened on desktop (`lg:max-w-5xl`) and falls back to horizontal scroll when there are enough lineups.

- [ ] **Step 5: Commit**

```bash
git add "app/more/supplier-lineup/compare/page.tsx" "docs/superpowers/specs/2026-06-24-supplier-lineup-compare-total-cards-design.md"
git -c commit.gpgsign=false commit -m "Restore Supplier Lineup compare header/Total row, bold and highlight Total"
```

---

### Task 2: Push and deploy

**Files:** none (deployment only)

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Deploy**

Run the project's existing Vercel deploy step (`vercel --prod`), per the established pattern for this project. Report the resulting production URL to the user.
