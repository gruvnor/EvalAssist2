# Air Force OPB Prep Tool

Extract the offline ZIP and open `opb.html` directly in your browser (`file://`). The multi-report editor, per-section writing prompts, action verb picker, acronym review, and backup/export tools run completely offline with zero installation, zero server processes, and zero network requests.

## Quick start

- **Manage reports:** Switch between reports or click **New report** in the Reports panel. Switching reports retains edits and loads each report’s metadata, six narratives, and Parking Lot notes.
- **Draft with live counts:** Edit all six OPB sections with live character/word counts and collapsible **Section guidance & ALQs**. Over-limit text is flagged visually and semantically (`aria-invalid`) but never truncated so you can edit it down.
- **Copy per-section AI prompts:** Click **Copy prompt and draft** below any narrative to copy a clarity prompt containing only that section’s label, character limit, instructions, and exact current text. Use **More prompts** for *Improve impact*, *Shorten to fit*, *Expand toward the character limit*, or *Polish grammar*. Paste into your chosen writing tool and paste any accepted revision back.
- **Review acronyms:** Terms absent from the bundled official AFPC list (and your local custom acronyms) appear under **Review against AFPC list** below each editor and are highlighted inline in **Preview & copy**. Copying plain text or printing preserves your original narrative with no highlight markup.
- **Save & back up:** Drafts autosave to browser storage (IndexedDB with `localStorage` fallback) when available. Because browser-local saves can depend on your browser profile and file path, use **Export JSON Backup** for full portable backups (all reports, active selection, metadata, narratives, Parking Lot, custom verbs, and custom acronyms) or **Export CSV** for reports alone.

## AFPC acronym reference

The bundled offline lookup uses the Air Force Personnel Center’s individually approved entries from the **October 28, 2024** update (148 entries, verified against [AFPC Career Management Acronyms](https://www.afpc.af.mil/Career-Management/Acronyms/)). AFPC separately permits common ranks, office symbols, squadron-and-above organizations, weapons/platforms, and standard measurements by category. Local custom acronyms only suppress local reminders and do not modify the official lookup.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Astro compiles the static bundle to `dist/index.html`, and `scripts/release.mjs` copies it to `release/opb.html` while verifying that no external runtime script, stylesheet, or asset references exist.
