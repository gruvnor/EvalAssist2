    "use strict";

    const FIELD_META = [
      {
        key: "duty_description",
        label: "Duty Description",
        limit: 450,
        description: "Describe duty scope, responsibilities, accountability, and relevant mission context."
      },
      {
        key: "executing_mission",
        label: "Executing the Mission",
        limit: 350,
        description: "Uses knowledge, initiative, and adaptability to produce timely, high-quality results that positively impact the mission."
      },
      {
        key: "leading_people",
        label: "Leading People",
        limit: 350,
        description: "Fosters cohesive teams, communicates effectively, and uses emotional intelligence to care for people and accomplish the mission."
      },
      {
        key: "managing_resources",
        label: "Managing Resources",
        limit: 350,
        description: "Manages assigned resources effectively and takes responsibility for actions and behaviors to maximize organizational performance."
      },
      {
        key: "improving_unit",
        label: "Improving the Unit",
        limit: 350,
        description: "Demonstrates critical thinking and fosters innovation to find creative solutions and improve mission execution."
      },
      {
        key: "hlr_assessment",
        label: "Higher Level Reviewer Assessment",
        limit: 250,
        description: "Draft the higher-level reviewer assessment in accordance with current guidance."
      }
    ];

    const DEFAULT_VERBS = [
      { verb: "Accelerated", category: "Mission Execution" },
      { verb: "Accomplished", category: "Mission Execution" },
      { verb: "Achieved", category: "Mission Execution" },
      { verb: "Adapted", category: "Mission Execution" },
      { verb: "Delivered", category: "Mission Execution" },
      { verb: "Executed", category: "Mission Execution" },
      { verb: "Implemented", category: "Mission Execution" },
      { verb: "Improved", category: "Mission Execution" },
      { verb: "Integrated", category: "Mission Execution" },

      { verb: "Coached", category: "Leadership" },
      { verb: "Developed", category: "Leadership" },
      { verb: "Directed", category: "Leadership" },
      { verb: "Empowered", category: "Leadership" },
      { verb: "Led", category: "Leadership" },
      { verb: "Mentored", category: "Leadership" },
      { verb: "Organized", category: "Leadership" },
      { verb: "Supervised", category: "Leadership" },
      { verb: "Strengthened", category: "Leadership" },

      { verb: "Allocated", category: "Resource Management" },
      { verb: "Consolidated", category: "Resource Management" },
      { verb: "Controlled", category: "Resource Management" },
      { verb: "Managed", category: "Resource Management" },
      { verb: "Optimized", category: "Resource Management" },
      { verb: "Prioritized", category: "Resource Management" },
      { verb: "Reduced", category: "Resource Management" },
      { verb: "Stewarded", category: "Resource Management" },

      { verb: "Analyzed", category: "Improvement" },
      { verb: "Created", category: "Improvement" },
      { verb: "Designed", category: "Improvement" },
      { verb: "Established", category: "Improvement" },
      { verb: "Innovated", category: "Improvement" },
      { verb: "Modernized", category: "Improvement" },
      { verb: "Resolved", category: "Improvement" },
      { verb: "Streamlined", category: "Improvement" }
    ];

    const DEFAULT_ACRONYMS = [];

    let saveTimer = null;
    let lastFocusedField = "duty_description";
    let workspaceVersion = 0;
    let activeImportId = 0;

    let state = createDefaultState();

    function createBlankDraft() {
      const draft = {
        parking_lot: ""
      };

      FIELD_META.forEach(field => {
        draft[field.key] = "";
      });

      return draft;
    }

    function createDefaultState() {
      return {
        version: 2,
        updatedAt: "",
        draft: createBlankDraft(),
        reports: [],
        activeReportId: "",
        verbs: OPB.mergeVerbs(
          DEFAULT_VERBS,
          Object.entries(OPB_VERBS).flatMap(([category, verbs]) => verbs.map(verb => ({ verb, category })))
        ),
        acronyms: [...DEFAULT_ACRONYMS]
      };
    }

    function sanitizeState(candidate) {
      const clean = OPB.sanitizeBackup(candidate, createDefaultState());
      clean.verbs = OPB.mergeVerbs(
        clean.verbs,
        DEFAULT_VERBS,
        Object.entries(OPB_VERBS).flatMap(([category, verbs]) => verbs.map(verb => ({ verb, category })))
      );
      return clean;
    }

    function markMutated() {
      workspaceVersion += 1;
      return workspaceVersion;
    }

    function setStatus(message, type = "") {
      const status = document.getElementById("status");
      if (!status) return;
      status.textContent = message;
      status.className = `status-bar ${type}`.trim();
    }

    function formatSavedTime(isoDate) {
      if (!isoDate) return "";
      try {
        const date = new Date(isoDate);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
      } catch {
        return "";
      }
    }

    async function initializeStorage() {
      const result = await OPB_STORAGE.loadInitialState({
        sanitizeState,
        createDefaultState,
        onVersionChange: () => {
          setStatus("Browser storage changed in another tab. Export a JSON backup before closing.", "error");
        }
      });

      if (result.state) {
        state = result.state;
      }

      return result.message;
    }

    async function saveStateNow(expectedVersion) {
      if (Number.isInteger(expectedVersion) && expectedVersion !== workspaceVersion) {
        return true;
      }

      syncActiveReport();
      state.updatedAt = new Date().toISOString();
      const saveVersion = workspaceVersion;
      const snapshot = JSON.parse(JSON.stringify(state));

      const outcome = await OPB_STORAGE.persistSnapshot(snapshot, saveVersion);
      if (outcome.skipped || saveVersion !== workspaceVersion) {
        return outcome.saved;
      }

      if (outcome.saved) {
        if (outcome.backend === "indexeddb") {
          setStatus(`Saved automatically to IndexedDB: ${formatSavedTime(state.updatedAt)}.`, "good");
        } else if (outcome.backend === "localStorage") {
          setStatus(`Saved automatically to browser local storage: ${formatSavedTime(state.updatedAt)}.`, "good");
        } else {
          setStatus("Saved to browser fallback storage. Export a backup for portability.", "good");
        }
        return true;
      }

      setStatus("Automatic saving was unavailable. Export a JSON backup before closing the browser.", "error");
      return false;
    }

    function queueSave() {
      clearTimeout(saveTimer);
      const versionAtQueue = markMutated();
      setStatus("Saving…");

      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveStateNow(versionAtQueue);
      }, 450);
    }

    function cancelQueuedSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    }

    function getFieldElement(key) {
      return document.getElementById(key);
    }

    function wordCount(text) {
      const words = String(text).trim().match(/\S+/g);
      return words ? words.length : 0;
    }

    function renderFields() {
      const container = document.getElementById("fieldContainer");
      container.replaceChildren();

      FIELD_META.forEach(field => {
        const card = document.createElement("article");
        card.className = "field-card";

        const header = document.createElement("div");
        header.className = "field-header";

        const headingGroup = document.createElement("div");
        headingGroup.className = "field-heading-group";

        const heading = document.createElement("h3");
        heading.textContent = field.label;

        const desc = document.createElement("p");
        desc.className = "field-description";
        desc.id = `${field.key}_desc`;
        desc.textContent = field.description;

        headingGroup.append(heading, desc);

        const countBadge = document.createElement("span");
        countBadge.className = "count";
        countBadge.id = `${field.key}_count`;
        countBadge.textContent = `0 / ${field.limit}`;

        header.append(headingGroup, countBadge);

        const body = document.createElement("div");
        body.className = "field-body";

        const textarea = document.createElement("textarea");
        textarea.id = field.key;
        textarea.placeholder = `Draft ${field.label.toLowerCase()} here...`;
        textarea.setAttribute("aria-label", field.label);
        textarea.setAttribute("aria-describedby", `${field.key}_desc ${field.key}_remaining`);
        textarea.value = state.draft[field.key] || "";

        const helperRow = document.createElement("div");
        helperRow.className = "helper-row";

        const remainingEl = document.createElement("span");
        remainingEl.id = `${field.key}_remaining`;
        remainingEl.textContent = `${field.limit} remaining`;

        const wordsEl = document.createElement("span");
        wordsEl.id = `${field.key}_words`;
        wordsEl.textContent = "0 words";

        const limitNote = document.createElement("span");
        limitNote.textContent = `Limit: ${field.limit} characters · excess text is preserved`;

        helperRow.append(remainingEl, wordsEl, limitNote);

        const reviewEl = document.createElement("div");
        reviewEl.className = "acronym-review";
        reviewEl.id = `${field.key}_review`;
        reviewEl.hidden = true;

        const printEl = document.createElement("div");
        printEl.className = "print-narrative";
        printEl.id = `${field.key}_print`;

        const advisoriesEl = document.createElement("ul");
        advisoriesEl.id = `${field.key}_advisories`;
        advisoriesEl.className = "advisories";

        const source = OPB.fields.find(f => OPB.legacyKeys[f.key] === field.key);
        const details = document.createElement("details");
        details.className = "guidance-details";
        const summary = document.createElement("summary");
        summary.textContent = "Section guidance & ALQs";
        const guidance = document.createElement("p");
        guidance.textContent = source ? source.alq : "";
        details.append(summary, guidance);

        body.append(textarea, helperRow, reviewEl, printEl, advisoriesEl, details);
        card.append(header, body);
        container.append(card);

        setupPromptActions(card, field, textarea);

        textarea.addEventListener("focus", () => {
          lastFocusedField = field.key;
          const verbTarget = document.getElementById("verbTarget");
          if (verbTarget) verbTarget.value = field.key;
        });

        textarea.addEventListener("input", () => {
          state.draft[field.key] = textarea.value;
          updateFieldMetrics(field);
          updatePreview();
          queueSave();
        });

        updateFieldMetrics(field);
      });

      const parkingLot = getFieldElement("parking_lot");
      parkingLot.value = state.draft.parking_lot || "";

      parkingLot.onfocus = () => {
        lastFocusedField = "parking_lot";
      };

      parkingLot.oninput = () => {
        state.draft.parking_lot = parkingLot.value;
        updateParkingLotMetrics();
        queueSave();
      };

      updateParkingLotMetrics();
    }

    function updateFieldMetrics(field) {
      const textarea = getFieldElement(field.key);
      if (!textarea) return;
      const text = textarea.value;
      const count = text.length;
      const remaining = field.limit - count;

      const countElement = document.getElementById(`${field.key}_count`);
      const remainingElement = document.getElementById(`${field.key}_remaining`);
      const wordElement = document.getElementById(`${field.key}_words`);
      const advisoryElement = document.getElementById(`${field.key}_advisories`);
      const printElement = document.getElementById(`${field.key}_print`);

      countElement.textContent = `${count} / ${field.limit}`;
      remainingElement.textContent = remaining < 0
        ? `${-remaining} over limit`
        : `${remaining} remaining`;
      remainingElement.classList.toggle("remaining-over", remaining < 0);
      wordElement.textContent = `${wordCount(text)} ${wordCount(text) === 1 ? "word" : "words"}`;
      printElement.textContent = text || "[Blank]";

      countElement.classList.toggle("at-limit", remaining === 0);
      countElement.classList.toggle("over-limit", remaining < 0);
      textarea.setAttribute("aria-invalid", remaining < 0 ? "true" : "false");

      advisoryElement.replaceChildren();
      const advisories = OPB.advisory(text, field.key, state.verbs, state.acronyms);
      renderAcronymReview(field, text);

      if (remaining < 0) {
        const li = document.createElement("li");
        li.className = "advisory-over";
        li.textContent = `${-remaining} character${-remaining === 1 ? "" : "s"} over the limit. Edit before submission; no text has been removed.`;
        advisoryElement.append(li);
      }

      advisories.forEach(message => {
        const li = document.createElement("li");
        li.textContent = message;
        advisoryElement.append(li);
      });
    }

    function updateParkingLotMetrics() {
      const parking = getFieldElement("parking_lot");
      if (!parking) return;
      const text = parking.value;
      const words = wordCount(text);
      document.getElementById("parkingLotCount").textContent =
        `${text.length} ${text.length === 1 ? "character" : "characters"} · ${words} ${words === 1 ? "word" : "words"}`;
    }

    function buildFullDraftText() {
      const r = activeReport();
      const headerLines = ["OFFICER PERFORMANCE BRIEF — DRAFT"];
      const officer = [r.rank, r.name].filter(Boolean).join(" ").trim();
      if (officer) headerLines.push(`Officer: ${officer}`);
      if (r.unit_name) headerLines.push(`Organization: ${r.unit_name}`);
      if (r.duty_title) headerLines.push(`Duty Title: ${r.duty_title}`);
      const period = [r.period_start, r.period_end].filter(Boolean).join(" to ");
      if (period) headerLines.push(`Reporting Period: ${period}`);

      const output = [...headerLines, ""];
      FIELD_META.forEach(field => {
        output.push(field.label.toUpperCase());
        output.push(state.draft[field.key] || "[Blank]");
        output.push("");
      });

      return output.join("\n").trim();
    }

    function updatePreview() {
      const previewEl = document.getElementById("preview");
      if (previewEl) {
        previewEl.textContent = buildFullDraftText();
      }
      if (typeof renderSectionPreviews === "function") {
        renderSectionPreviews();
      }
    }

    function renderVerbControls() {
      const target = document.getElementById("verbTarget");
      const priorTarget = target.value || lastFocusedField;

      target.replaceChildren();
      FIELD_META.forEach(field => {
        const option = document.createElement("option");
        option.value = field.key;
        option.textContent = field.label;
        target.append(option);
      });

      if ([...target.options].some(option => option.value === priorTarget)) {
        target.value = priorTarget;
      }

      const category = document.getElementById("verbCategory");
      const priorCategory = category.value || "All";
      const categories = ["All", ...new Set(
        state.verbs.map(item => item.category).filter(Boolean).sort()
      )];

      category.replaceChildren();
      categories.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        category.append(option);
      });

      category.value = categories.includes(priorCategory) ? priorCategory : "All";
      renderVerbList();
    }

    function renderVerbList() {
      const category = document.getElementById("verbCategory").value;
      const filter = document.getElementById("verbSearch").value.trim().toLowerCase();
      const list = document.getElementById("verbList");

      const matchingVerbs = state.verbs.filter(item => {
        const categoryMatch = category === "All" || item.category === category;
        const searchMatch = !filter || item.verb.toLowerCase().includes(filter);
        return categoryMatch && searchMatch;
      });

      list.replaceChildren();

      if (!matchingVerbs.length) {
        const empty = document.createElement("span");
        empty.className = "small-note";
        empty.textContent = "No matching action verbs.";
        list.append(empty);
        return;
      }

      matchingVerbs.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "verb";
        button.textContent = item.verb;
        button.title = item.category;

        button.addEventListener("click", () => {
          const fieldKey = document.getElementById("verbTarget").value;
          const field = getFieldElement(fieldKey);

          if (!field) {
            setStatus("Select an OPB field before inserting a verb.", "error");
            return;
          }

          insertAtCursor(field, `${item.verb} `);
          lastFocusedField = fieldKey;
        });

        list.append(button);
      });
    }

    function renderCustomAcronyms() {
      const list = document.getElementById("customAcronymList");
      if (!list) return;
      list.replaceChildren();

      state.acronyms.forEach(term => {
        const chip = document.createElement("span");
        chip.className = "acronym-chip";

        const label = document.createElement("span");
        label.textContent = term;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "×";
        removeBtn.setAttribute("aria-label", `Remove custom acronym ${term}`);
        removeBtn.addEventListener("click", () => {
          state.acronyms = state.acronyms.filter(item => item !== term);
          renderCustomAcronyms();
          FIELD_META.forEach(updateFieldMetrics);
          updatePreview();
          queueSave();
          setStatus(`Removed ${term} from your local custom acronyms.`, "good");
        });

        chip.append(label, removeBtn);
        list.append(chip);
      });
    }

    function insertAtCursor(element, text) {
      const start = Number.isInteger(element.selectionStart)
        ? element.selectionStart
        : element.value.length;

      const end = Number.isInteger(element.selectionEnd)
        ? element.selectionEnd
        : element.value.length;

      const before = element.value.slice(0, start);
      const after = element.value.slice(end);
      const needsSpace = before && !/\s$/.test(before);
      const insertText = `${needsSpace ? " " : ""}${text}`;

      element.value = `${before}${insertText}${after}`;

      const cursor = Math.min(before.length + insertText.length, element.value.length);
      element.focus();
      element.setSelectionRange(cursor, cursor);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    async function copyText(text) {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
          throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        const previousFocus = document.activeElement;
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.top = "0";
        helper.style.left = "-9999px";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.focus({ preventScroll: true });
        helper.select();
        helper.setSelectionRange(0, text.length);

        let result = false;
        try {
          result = document.execCommand("copy");
        } catch {
          result = false;
        }

        helper.remove();
        if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
        return result;
      }
    }

    function downloadFile(filename, text, type = "application/json;charset=utf-8") {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function exportBackup() {
      cancelQueuedSave();
      markMutated();
      await saveStateNow();

      const backup = {
        application: "OPB Performance Statement Prep Tool",
        backupVersion: 2,
        exportedAt: new Date().toISOString(),
        state
      };

      const date = new Date().toISOString().slice(0, 10);
      downloadFile(
        `OPB-Prep-Backup-${date}.json`,
        JSON.stringify(backup, null, 2)
      );

      setStatus("JSON backup download requested. Confirm the file was saved.", "good");
    }

    function importBackup(file) {
      if (file.size > 10 * 1024 * 1024) {
        setStatus("Choose a backup smaller than 10 MB.", "error");
        return;
      }

      const requestId = ++activeImportId;
      const versionAtStart = workspaceVersion;
      const reader = new FileReader();

      reader.onload = async () => {
        if (requestId !== activeImportId) return;

        try {
          const imported = JSON.parse(reader.result);
          const importedState = imported && typeof imported === "object" && imported.state ? imported.state : imported;

          if (!importedState || typeof importedState !== "object" || Array.isArray(importedState)) {
            throw new Error("The selected file does not contain a valid OPB backup.");
          }

          const validated = sanitizeState(importedState);
          const changedWhileReading = workspaceVersion !== versionAtStart;
          const confirmMessage = changedWhileReading
            ? "New edits or report changes occurred while reading this file. Importing this backup will replace all current reports, action verbs, and custom acronyms. Continue?"
            : "Importing this backup will replace all current reports, action verbs, and custom acronyms. Export a backup first if needed. Continue?";

          const replace = window.confirm(confirmMessage);
          if (!replace || requestId !== activeImportId) return;

          cancelQueuedSave();
          state = validated;
          ensureReports();
          markMutated();

          renderReportControls();
          renderFields();
          renderVerbControls();
          renderCustomAcronyms();
          updatePreview();

          const saved = await saveStateNow();
          setStatus(
            saved
              ? "Backup imported and saved to this browser."
              : "Backup imported into memory. Browser saving is unavailable; export a backup before closing.",
            saved ? "good" : "error"
          );
        } catch (error) {
          setStatus(`Could not import backup: ${error.message}`, "error");
        }
      };

      reader.onerror = () => {
        if (requestId === activeImportId) {
          setStatus("Could not read the selected backup file.", "error");
        }
      };

      reader.readAsText(file);
    }

    async function clearDraft() {
      const confirmed = window.confirm(
        "Clear this report’s OPB fields and Parking Lot? Other reports, report metadata, and custom helper terms will remain."
      );

      if (!confirmed) return;

      cancelQueuedSave();
      state.draft = createBlankDraft();
      markMutated();

      renderFields();
      updatePreview();
      const saved = await saveStateNow();

      setStatus(
        saved
          ? "Draft fields cleared. Report metadata and custom helper terms were retained."
          : "Draft cleared in memory. Browser saving is unavailable; export a backup before closing.",
        saved ? "good" : "error"
      );
    }

    function addCustomVerb() {
      const verbInput = document.getElementById("newVerb");
      const categoryInput = document.getElementById("newVerbCategory");

      const verb = verbInput.value.trim();
      const category = categoryInput.value.trim() || "General";

      if (!verb) {
        setStatus("Enter an action verb before selecting Add.", "error");
        return;
      }

      const duplicate = state.verbs.some(item =>
        item.verb.toLowerCase() === verb.toLowerCase() &&
        item.category.toLowerCase() === category.toLowerCase()
      );

      if (duplicate) {
        setStatus("That action verb already exists in this category.", "error");
        return;
      }

      state.verbs.push({ verb, category });
      state.verbs.sort((a, b) => a.verb.localeCompare(b.verb));

      verbInput.value = "";
      categoryInput.value = "";

      renderVerbControls();
      queueSave();

      setStatus(`Added action verb: ${verb}.`, "good");
    }

    function addCustomAcronym() {
      const input = document.getElementById("newAcronym");
      const acronym = input.value.trim().toUpperCase();

      if (!/^[A-Z0-9&/-]{2,}$/.test(acronym)) {
        setStatus("Use at least two letters, numbers, ampersands, hyphens, or slashes.", "error");
        return;
      }

      if (!state.acronyms.includes(acronym)) {
        state.acronyms.push(acronym);
        state.acronyms.sort();
      }

      input.value = "";

      renderCustomAcronyms();
      FIELD_META.forEach(updateFieldMetrics);
      updatePreview();
      queueSave();

      setStatus(`Added ${acronym} to your local custom acronyms (official AFPC list unchanged).`, "good");
    }

    function ensureReports() {
      if (!state.reports.length) {
        const r = OPB.reportFromDraft(state.draft);
        state.reports = [r];
        state.activeReportId = r.id;
      }
      if (!state.reports.some(r => r.id === state.activeReportId)) {
        state.activeReportId = state.reports[0].id;
      }
    }

    function activeReport() {
      ensureReports();
      return state.reports.find(r => r.id === state.activeReportId);
    }

    function syncActiveReport() {
      const report = activeReport();
      const i = state.reports.findIndex(r => r.id === report.id);
      state.reports[i] = OPB.reportFromDraft(state.draft, report);
      state.reports[i].updated_at = new Date().toISOString();
    }

    function formatReportOptionLabel(report) {
      return [report.rank, report.name || "Untitled officer"].filter(Boolean).join(" ");
    }

    function renderReportControls() {
      ensureReports();
      const select = document.getElementById("reportSelect");
      select.replaceChildren();
      state.reports.forEach(r => {
        const option = document.createElement("option");
        option.value = r.id;
        option.textContent = formatReportOptionLabel(r);
        select.append(option);
      });
      select.value = state.activeReportId;
      const current = activeReport();
      document.querySelectorAll("[data-meta]").forEach(el => {
        el.value = current[el.dataset.meta] || "";
      });
    }

    function exportCSV() {
      syncActiveReport();
      downloadFile(
        `opb-reports-${new Date().toISOString().slice(0, 10)}.csv`,
        OPB.serialize(state.reports),
        "text/csv;charset=utf-8"
      );
      setStatus("CSV download requested. All reports included. Export JSON Backup to also preserve custom helper terms.", "good");
    }

    async function importCSV(file) {
      const requestId = ++activeImportId;
      try {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("Choose a CSV smaller than 10 MB.");
        }
        const text = await file.text();
        if (requestId !== activeImportId) return;

        const reports = OPB.importCSV(text);
        const collisions = reports.filter(r => state.reports.some(existing => existing.id === r.id)).length;
        const additions = reports.length - collisions;

        if (collisions) {
          const message = `Import ${reports.length} report(s)? This will replace ${collisions} existing report(s) with matching IDs${additions ? ` and add ${additions} new report(s)` : ""}. Export a backup first if needed.`;
          if (!window.confirm(message) || requestId !== activeImportId) return;
        }

        cancelQueuedSave();
        syncActiveReport();
        for (const r of reports) {
          const i = state.reports.findIndex(existing => existing.id === r.id);
          if (i < 0) state.reports.push(r);
          else state.reports[i] = r;
        }
        state.activeReportId = reports[0].id;
        state.draft = OPB.draftFromReport(reports[0]);
        markMutated();

        renderReportControls();
        renderFields();
        updatePreview();
        const saved = await saveStateNow();

        setStatus(
          saved
            ? `Imported ${reports.length} report(s) from CSV and saved to this browser.`
            : `Imported ${reports.length} report(s) into memory. Browser saving is unavailable; export a backup before closing.`,
          saved ? "good" : "error"
        );
      } catch (error) {
        if (requestId === activeImportId) {
          setStatus(`CSV import failed: ${error.message}`, "error");
        }
      }
    }

    function setupReportControls() {
      document.getElementById("reportSelect").addEventListener("change", event => {
        cancelQueuedSave();
        syncActiveReport();
        state.activeReportId = event.target.value;
        state.draft = OPB.draftFromReport(activeReport());
        renderReportControls();
        renderFields();
        updatePreview();
        queueSave();
      });

      document.getElementById("newReportBtn").addEventListener("click", () => {
        cancelQueuedSave();
        syncActiveReport();
        const report = OPB.blank();
        state.reports.push(report);
        state.activeReportId = report.id;
        state.draft = OPB.draftFromReport(report);
        renderReportControls();
        renderFields();
        updatePreview();
        queueSave();
        setStatus("Created a new report.", "good");
      });

      document.querySelectorAll("[data-meta]").forEach(el => {
        el.addEventListener("input", () => {
          activeReport()[el.dataset.meta] = el.value;
          const option = document.getElementById("reportSelect").selectedOptions[0];
          if (option) {
            option.textContent = formatReportOptionLabel(activeReport());
          }
          updatePreview();
          queueSave();
        });
      });

      document.getElementById("exportCsvBtn").addEventListener("click", exportCSV);
      document.getElementById("importCsvInput").addEventListener("change", event => {
        const file = event.target.files[0];
        if (file) importCSV(file);
        event.target.value = "";
      });

      document.getElementById("printBtn").addEventListener("click", () => {
        renderPreviewMetadata();
        window.print();
      });

      const previewPrintBtn = document.getElementById("previewPrintBtn");
      if (previewPrintBtn) {
        previewPrintBtn.addEventListener("click", () => {
          renderPreviewMetadata();
          window.print();
        });
      }

      window.addEventListener("beforeunload", event => {
        if (saveTimer) {
          cancelQueuedSave();
          saveStateNow();
          event.preventDefault();
          event.returnValue = "";
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && saveTimer) {
          cancelQueuedSave();
          saveStateNow();
        }
      });
    }

    async function copyFullDraftAction() {
      const copied = await copyText(buildFullDraftText());
      setStatus(
        copied ? "Full report draft copied to clipboard." : "Clipboard copy was blocked by the browser.",
        copied ? "good" : "error"
      );
    }

    async function initialize() {
      document.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = true; });
      const storageMessage = await initializeStorage();
      setupReportControls();
      setupPreview();
      document.querySelectorAll("button,input,select,textarea").forEach(el => { el.disabled = false; });

      ensureReports();
      renderReportControls();
      renderFields();
      renderVerbControls();
      renderCustomAcronyms();
      updatePreview();

      setStatus(
        `${storageMessage} Storage: ${OPB_STORAGE.hasDatabase() ? "browser database" : "browser fallback when available"}.`,
        OPB_STORAGE.hasDatabase() ? "good" : ""
      );

      document.getElementById("verbCategory").addEventListener("change", renderVerbList);
      document.getElementById("verbSearch").addEventListener("input", renderVerbList);
      document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);

      document.getElementById("importBackupInput").addEventListener("change", event => {
        const file = event.target.files[0];
        if (file) importBackup(file);
        event.target.value = "";
      });

      document.getElementById("copyDraftBtn").addEventListener("click", copyFullDraftAction);
      document.getElementById("copyPreviewBtn").addEventListener("click", copyFullDraftAction);

      const previewCopyFullBtn = document.getElementById("previewCopyFullBtn");
      if (previewCopyFullBtn) {
        previewCopyFullBtn.addEventListener("click", copyFullDraftAction);
      }

      document.getElementById("clearDraftBtn").addEventListener("click", clearDraft);
      document.getElementById("addVerbBtn").addEventListener("click", addCustomVerb);
      document.getElementById("addAcronymBtn").addEventListener("click", addCustomAcronym);
    }

    initialize().catch(error => setStatus(`Could not initialize: ${error.message}. Reload or import a backup.`, "error"));
