(function (root) {
  "use strict";

  const byId = id => document.getElementById(id);

  function formatMetadataEntries(report) {
    const period = [report.period_start, report.period_end].filter(Boolean).join(" to ");
    return [
      { label: "Officer name", value: report.name || "Untitled officer" },
      { label: "Rank", value: report.rank || "—" },
      { label: "Organization", value: report.unit_name || "—" },
      { label: "Duty title", value: report.duty_title || "—" },
      { label: "Reporting period", value: period || "—" }
    ];
  }

  function renderPreviewMetadata() {
    const report = activeReport();
    const entries = formatMetadataEntries(report);

    for (const targetId of ["previewMetadata", "printReportMeta"]) {
      const container = byId(targetId);
      if (!container) continue;
      container.replaceChildren();
      for (const item of entries) {
        const wrapper = document.createElement("div");
        wrapper.className = "preview-meta-item";
        const dt = document.createElement("dt");
        dt.textContent = item.label;
        const dd = document.createElement("dd");
        dd.textContent = item.value;
        wrapper.append(dt, dd);
        container.append(wrapper);
      }
    }
  }

  function renderSectionPreviews() {
    renderPreviewMetadata();
    const container = byId("sectionPreviews");
    if (!container) return;
    container.replaceChildren();

    for (const field of FIELD_META) {
      const rawText = state.draft[field.key] || "";
      const card = document.createElement("section");
      card.className = "section-preview";

      const header = document.createElement("div");
      header.className = "preview-heading";

      const title = document.createElement("h3");
      title.textContent = field.label;

      const actions = document.createElement("div");
      actions.className = "preview-heading-actions";

      const copyStatus = document.createElement("span");
      copyStatus.className = "preview-copy-status";
      copyStatus.setAttribute("role", "status");
      copyStatus.setAttribute("aria-live", "polite");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = "Copy text";
      button.disabled = !rawText;
      button.setAttribute("aria-label", `Copy ${field.label} text`);
      button.addEventListener("click", async () => {
        const currentText = state.draft[field.key] || "";
        const ok = await copyText(currentText);
        copyStatus.textContent = ok ? "Copied" : "Copy unavailable";
        copyStatus.classList.toggle("error", !ok);
        setTimeout(() => {
          copyStatus.textContent = "";
          copyStatus.classList.remove("error");
        }, 2000);
      });

      actions.append(copyStatus, button);
      header.append(title, actions);

      const textEl = document.createElement("p");
      textEl.className = rawText ? "section-preview-text" : "section-preview-text is-blank";
      if (rawText) {
        renderAcronymHighlights(textEl, rawText);
      } else {
        textEl.textContent = "[Blank]";
      }

      const countEl = document.createElement("small");
      const over = rawText.length - field.limit;
      countEl.className = over > 0 ? "section-preview-meta over-limit" : "section-preview-meta";
      countEl.textContent = over > 0
        ? `${rawText.length} / ${field.limit} characters (${over} over limit)`
        : `${rawText.length} / ${field.limit} characters`;

      card.append(header, textEl, countEl);
      container.append(card);
    }
  }

  function setReportView(preview) {
    byId("editorLayout").hidden = preview;
    byId("reportPreviewPanel").hidden = !preview;
    byId("editViewBtn").setAttribute("aria-pressed", String(!preview));
    byId("previewViewBtn").setAttribute("aria-pressed", String(preview));
    byId("editViewBtn").classList.toggle("secondary", preview);
    byId("previewViewBtn").classList.toggle("secondary", !preview);
    if (preview) renderSectionPreviews();
  }

  function setupPreview() {
    byId("editViewBtn").addEventListener("click", () => setReportView(false));
    byId("previewViewBtn").addEventListener("click", () => setReportView(true));
  }

  root.renderPreviewMetadata = renderPreviewMetadata;
  root.renderSectionPreviews = renderSectionPreviews;
  root.setReportView = setReportView;
  root.setupPreview = setupPreview;
})(typeof window !== "undefined" ? window : globalThis);
