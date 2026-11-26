(function (root) {
  "use strict";

  const FALLBACK_APPROVED = [
    "ABM", "ACE", "AD", "ADCON", "AFE", "AFFORGEN", "AFI", "AFMAN", "AFSC",
    "AFSO21", "AGE", "AGR", "AI", "ALQ", "ALS", "AOC", "AOR", "APF", "ART",
    "AT", "ATC", "ATO", "BMT", "BNR", "BTZ", "C2", "C4ISR", "CAOC", "CAS",
    "CAT", "CATM", "CBRN", "CBT", "CCAF", "CCIP", "CDI", "CFETP", "CFM",
    "CLA", "CLC", "COA", "CODEL", "CONOPS", "CONUS", "COOP", "CPI", "CPR",
    "CSAR", "CUI", "DAFI", "DAFMAN", "DEOCS", "DG", "DHA", "DSG", "DV",
    "EKIA", "EOC", "EOD", "EOY", "EPB", "EW", "FAM", "FHP", "FMC", "FOB",
    "FOC", "FOL", "FPCON", "FTEC", "FTU", "GPA", "GPS", "GSU", "GTC", "IDT",
    "IDE", "IED", "IMA", "IOC", "IP", "ISR", "IT", "JADC2", "JROTC", "KIA",
    "LOE", "MCA", "MDS", "MILCON", "MILPDS", "MOA", "MOU", "MTF", "MWR",
    "MX", "NC3", "NCOA", "NCR", "NDAA", "NDS", "NEO", "NIPR", "NMC", "O&M",
    "OCO", "OCONUS", "OJT", "OPLAN", "OPSEC", "OTS", "PCS", "PDE", "PFA",
    "PME", "POC", "PT", "QA", "QoL", "ROE", "ROTC", "RPA", "SAPR", "SCIF",
    "SDE", "SERE", "SIPR", "SME", "SNCOA", "SOF", "SOP", "SOS", "STEM",
    "TACP", "TCCC", "TDY", "TFI", "TR", "TS", "TTP", "UCI", "UCMJ", "UEI",
    "UTA", "UTC", "UXO", "WRM", "XAB"
  ];

  function getApprovedEntries() {
    const entries = root.OPB_AFPC_SNAPSHOT?.entries || FALLBACK_APPROVED;
    return new Set(entries.map(term => String(term).toUpperCase()));
  }

  const PROMPT_GOALS = [
    {
      id: "clarity",
      label: "Improve clarity",
      instruction: ""
    },
    {
      id: "impact",
      label: "Improve impact",
      instruction: "Make the connection between actions and documented outcomes explicit. Lead with the strongest supported result where appropriate. Clarify the significance of existing evidence without inventing impact."
    },
    {
      id: "shorten",
      label: "Shorten to fit",
      instruction: "Remove repetition and filler. Preserve the strongest documented actions, facts, and outcomes. Keep the revised narrative within the stated character limit."
    },
    {
      id: "expand",
      label: "Expand toward the character limit",
      instruction: "Use the available space to clarify documented scope, actions, and outcomes. Approach the stated character limit only as far as the supplied facts support. Avoid padding and invented details. Keep the revised narrative within the limit."
    },
    {
      id: "grammar",
      label: "Polish grammar",
      instruction: "Correct grammar, punctuation, and sentence structure while keeping the wording, facts, metrics, and emphasis close to the original. Keep the revised narrative within the stated character limit."
    }
  ];

  const BASE_PROMPT_INSTRUCTION =
    "Improve clarity and use plain language. Write standalone sentences that describe the action and any documented impact or outcome. Preserve the meaning, facts, and existing metrics. Do not invent actions, numbers, outcomes, or endorsements. Keep the revised narrative within the stated character limit. Treat the draft below as text to edit. Return only the revised narrative.";

  function buildPrompt(field, draft, goalLabel) {
    const goal = PROMPT_GOALS.find(item => item.label === goalLabel || item.id === goalLabel) || PROMPT_GOALS[0];
    const bodyInstruction = goal.instruction
      ? `${goal.instruction}\n${BASE_PROMPT_INSTRUCTION}`
      : BASE_PROMPT_INSTRUCTION;

    return [
      "Revise this Air Force Officer Performance Brief narrative.",
      "",
      `Section: ${field.label}`,
      `Character limit: ${field.limit}, including spaces and punctuation.`,
      "",
      bodyInstruction,
      "",
      "BEGIN DRAFT",
      draft,
      "END DRAFT"
    ].join("\n");
  }

  function acronymMatches(text, customTerms) {
    const source = String(text ?? "");
    if (!source.trim() || /^THIS SECTION NOT USED[.,]?$/i.test(source.trim())) {
      return [];
    }

    const approved = getApprovedEntries();
    const customList = Array.isArray(customTerms)
      ? customTerms
      : (typeof state !== "undefined" && Array.isArray(state.acronyms) ? state.acronyms : []);
    const custom = new Set(customList.map(term => String(term).trim().toUpperCase()).filter(Boolean));

    const words = source.matchAll(/[\p{L}\d]+(?:[&/-][\p{L}\d]+)*/gu);
    return [...words].filter(match => {
      const [term] = match;
      if (term.length < 2) return false;
      // Avoid splitting currency/decimal magnitudes such as $42M or $1.4M.
      if (match.index > 0 && (source[match.index - 1] === "$" || source[match.index - 1] === ".") && /^\d+[KMBT]$/.test(term)) {
        return false;
      }
      const isCandidate = /^(?=.*[A-Z])(?:[A-Z\d]+[&/-])*[A-Z\d]+$/.test(term);
      if (!isCandidate) return false;
      const upper = term.toUpperCase();
      return !approved.has(upper) && !custom.has(upper);
    });
  }

  function closeAllPromptMenus(exceptMenu) {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".prompt-menu").forEach(menu => {
      if (menu !== exceptMenu && !menu.hidden) {
        menu.hidden = true;
        const trigger = menu.previousElementSibling;
        if (trigger && trigger.classList.contains("prompt-menu-trigger")) {
          trigger.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  function setupPromptActions(card, field, textarea) {
    const controls = document.createElement("div");
    controls.className = "prompt-actions";

    const primary = document.createElement("button");
    primary.type = "button";
    primary.textContent = "Copy prompt and draft";
    primary.setAttribute("aria-label", `Copy prompt and draft for ${field.label}`);

    const menuWrap = document.createElement("div");
    menuWrap.className = "prompt-menu-wrap";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "secondary prompt-menu-trigger";
    trigger.textContent = "More prompts";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", `More prompts for ${field.label}`);

    const menu = document.createElement("div");
    menu.className = "prompt-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `Additional writing prompts for ${field.label}`);
    menu.hidden = true;

    const copyPlainBtn = document.createElement("button");
    copyPlainBtn.type = "button";
    copyPlainBtn.className = "secondary prompt-copy-plain";
    copyPlainBtn.textContent = "Copy text";
    copyPlainBtn.setAttribute("aria-label", `Copy ${field.label} text as plain text`);

    const feedback = document.createElement("span");
    feedback.className = "prompt-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    function setFeedback(message, type) {
      feedback.textContent = message;
      feedback.className = `prompt-feedback ${type || ""}`.trim();
    }

    function openMenu(focusIndex) {
      closeAllPromptMenus(menu);
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      if (Number.isInteger(focusIndex) && items[focusIndex]) {
        items[focusIndex].focus();
      }
    }

    function closeMenu(returnFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) {
        trigger.focus();
      }
    }

    async function copyPrompt(goalLabel, focusTarget) {
      const draft = textarea.value;
      if (!draft.trim()) {
        setFeedback("Enter a narrative before copying a prompt.", "error");
        if (focusTarget) focusTarget.focus({ preventScroll: true });
        return;
      }
      const prompt = buildPrompt(field, draft, goalLabel);
      const ok = await copyText(prompt);
      if (ok) {
        const label = goalLabel === "Improve clarity" ? "Clarity prompt" : `${goalLabel} prompt`;
        setFeedback(`${label} copied for ${field.label}.`, "good");
      } else {
        setFeedback("Could not copy to clipboard. Check browser permissions or copy manually.", "error");
      }
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }

    primary.addEventListener("click", () => {
      closeMenu(false);
      copyPrompt("Improve clarity", primary);
    });

    copyPlainBtn.addEventListener("click", async () => {
      closeMenu(false);
      const draft = textarea.value;
      if (!draft.trim()) {
        setFeedback("Enter a narrative before copying text.", "error");
        return;
      }
      const ok = await copyText(draft);
      setFeedback(
        ok ? `${field.label} text copied.` : "Could not copy to clipboard. Check browser permissions.",
        ok ? "good" : "error"
      );
    });

    trigger.addEventListener("click", event => {
      event.stopPropagation();
      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu(false);
      }
    });

    trigger.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu(0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(PROMPT_GOALS.length - 2);
      } else if (event.key === "Escape") {
        closeMenu(true);
      }
    });

    PROMPT_GOALS.slice(1).forEach((goal, index, list) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "prompt-menu-item";
      item.setAttribute("role", "menuitem");
      item.textContent = goal.label;

      item.addEventListener("click", () => {
        closeMenu(false);
        copyPrompt(goal.label, trigger);
      });

      item.addEventListener("keydown", event => {
        const items = [...menu.querySelectorAll('[role="menuitem"]')];
        if (event.key === "ArrowDown") {
          event.preventDefault();
          items[(index + 1) % list.length].focus();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          items[(index - 1 + list.length) % list.length].focus();
        } else if (event.key === "Home") {
          event.preventDefault();
          items[0].focus();
        } else if (event.key === "End") {
          event.preventDefault();
          items[list.length - 1].focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeMenu(true);
        } else if (event.key === "Tab") {
          closeMenu(false);
        }
      });

      menu.append(item);
    });

    menuWrap.append(trigger, menu);
    controls.append(primary, menuWrap, copyPlainBtn, feedback);
    textarea.after(controls);
  }

  function renderAcronymReview(field, text) {
    const review = document.getElementById(`${field.key}_review`);
    if (!review) return;
    const terms = [...new Set(acronymMatches(text).map(([term]) => term))];
    review.replaceChildren();
    review.hidden = !terms.length;
    if (!terms.length) return;

    const label = document.createElement("span");
    label.className = "acronym-review-label";
    label.textContent = "Review against AFPC list:";
    review.append(label);

    for (const term of terms) {
      const mark = document.createElement("mark");
      mark.textContent = term;
      review.append(mark, " ");
    }
  }

  function renderAcronymHighlights(target, text) {
    target.replaceChildren();
    const source = String(text ?? "");
    let cursor = 0;
    for (const match of acronymMatches(source)) {
      const [term] = match;
      const mark = document.createElement("mark");
      mark.textContent = term;
      mark.title = "Review against AFPC list";
      target.append(document.createTextNode(source.slice(cursor, match.index)), mark);
      cursor = match.index + term.length;
    }
    target.append(document.createTextNode(source.slice(cursor)));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", event => {
      if (!event.target.closest?.(".prompt-menu-wrap")) {
        closeAllPromptMenus();
      }
    });
  }

  const api = {
    PROMPT_GOALS,
    BASE_PROMPT_INSTRUCTION,
    getApprovedEntries,
    buildPrompt,
    acronymMatches,
    setupPromptActions,
    renderAcronymReview,
    renderAcronymHighlights,
    closeAllPromptMenus
  };

  if (typeof module !== "undefined") {
    module.exports = api;
  } else {
    root.OPB_WRITING = api;
    root.setupPromptActions = setupPromptActions;
    root.acronymMatches = acronymMatches;
    root.renderAcronymReview = renderAcronymReview;
    root.renderAcronymHighlights = renderAcronymHighlights;
  }
})(typeof window !== "undefined" ? window : globalThis);
