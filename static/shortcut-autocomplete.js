(() => {
  function readSuggestions() {
    const script = document.getElementById("shortcut-data");
    if (!script) return [];
    try {
      return JSON.parse(script.textContent || "[]");
    } catch {
      return [];
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const inputs = Array.from(document.querySelectorAll("#formula, #formula_b"));
  const popup = document.getElementById("shortcut-popup");
  const suggestions = readSuggestions();
  if (!inputs.length || !popup || !suggestions.length) return;

  let activeItems = [];
  let activeIndex = 0;
  let activeInput = inputs[0];
  const VIEWPORT_GAP = 8;
  const MIN_POPUP_HEIGHT = 128;
  const MAX_POPUP_HEIGHT = 340;

  function tokenMatch() {
    const input = activeInput;
    const caret = input.selectionStart ?? input.value.length;
    const prefix = input.value.slice(0, caret);
    const match = prefix.match(/(?:^|[^A-Za-z0-9_])([/\\][A-Za-z]*)$/);
    if (!match) return null;
    return {
      token: match[1],
      start: caret - match[1].length,
      end: caret,
    };
  }

  function filterSuggestions(token) {
    const lowered = token.toLowerCase();
    return suggestions.filter((item) => {
      const candidates = [item.command, ...(item.triggers || []), ...(item.aliases || [])];
      return candidates.some((candidate) =>
        String(candidate).toLowerCase().startsWith(lowered)
      );
    });
  }

  function positionPopup() {
    const input = activeInput;
    const rect = input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const margin = viewportWidth < 520 ? 8 : 12;
    const width = Math.min(Math.max(rect.width, 430), viewportWidth - margin * 2);
    const left = Math.min(Math.max(rect.left, margin), viewportWidth - width - margin);
    const below = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_GAP - margin);
    const above = Math.max(0, rect.top - VIEWPORT_GAP - margin);
    const openAbove = below < MIN_POPUP_HEIGHT && above > below;
    const available = openAbove ? above : below;
    const maxHeight = Math.max(
      MIN_POPUP_HEIGHT,
      Math.min(MAX_POPUP_HEIGHT, available || viewportHeight - margin * 2)
    );
    const top = openAbove
      ? Math.max(margin, rect.top - VIEWPORT_GAP - maxHeight)
      : Math.min(rect.bottom + VIEWPORT_GAP, viewportHeight - margin - maxHeight);

    popup.style.width = `${width}px`;
    popup.style.left = `${left}px`;
    popup.style.top = `${Math.max(margin, top)}px`;
    popup.style.maxHeight = `${maxHeight}px`;
    popup.dataset.placement = openAbove ? "top" : "bottom";
  }

  function hidePopup() {
    popup.classList.remove("visible");
    popup.setAttribute("aria-hidden", "true");
    popup.innerHTML = "";
    activeItems = [];
    activeIndex = 0;
  }

  function scrollActiveRowIntoView() {
    const activeRow = popup.querySelector(".shortcut-row.active");
    if (!activeRow) return;
    activeRow.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function applySuggestion(item) {
    const input = activeInput;
    const match = tokenMatch();
    if (!match) {
      hidePopup();
      return;
    }

    const nextValue =
      input.value.slice(0, match.start)
      + item.symbol
      + input.value.slice(match.end);
    const caret = match.start + String(item.symbol).length;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    input.setSelectionRange(caret, caret);
    hidePopup();
  }

  function render(items, options = {}) {
    activeItems = items;
    if (!items.length) {
      hidePopup();
      return;
    }
    if (activeIndex >= items.length) activeIndex = 0;

    popup.innerHTML = items
      .map((item, index) => `
        <button type="button" class="shortcut-row ${index === activeIndex ? "active" : ""}" data-index="${index}">
          <span class="shortcut-symbol">${escapeHtml(item.symbol)}</span>
          <span class="shortcut-command">${escapeHtml(item.command)}</span>
          <span class="shortcut-aliases">
            ${(item.aliases || []).map((alias) => `
              <span class="shortcut-chip">${escapeHtml(alias)}</span>
            `).join("")}
          </span>
        </button>
      `)
      .join("");

    for (const row of popup.querySelectorAll(".shortcut-row")) {
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const index = Number(row.dataset.index);
        applySuggestion(activeItems[index]);
      });
    }

    positionPopup();
    popup.classList.add("visible");
    popup.setAttribute("aria-hidden", "false");
    if (options.scrollActive) scrollActiveRowIntoView();
  }

  function updatePopup() {
    const match = tokenMatch();
    if (!match) {
      hidePopup();
      return;
    }
    activeIndex = 0;
    render(filterSuggestions(match.token));
  }

  for (const input of inputs) {
    input.addEventListener("input", () => {
      activeInput = input;
      updatePopup();
    });
    input.addEventListener("focus", () => {
      activeInput = input;
      updatePopup();
    });
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (!popup.matches(":hover")) hidePopup();
      }, 120);
    });

    input.addEventListener("keydown", (event) => {
      activeInput = input;
      if (!popup.classList.contains("visible") || !activeItems.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % activeItems.length;
        render(activeItems, { scrollActive: true });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + activeItems.length) % activeItems.length;
        render(activeItems, { scrollActive: true });
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySuggestion(activeItems[activeIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        hidePopup();
      }
    });
  }

  window.addEventListener("resize", () => {
    if (popup.classList.contains("visible")) positionPopup();
  });
  window.addEventListener("scroll", () => {
    if (popup.classList.contains("visible")) positionPopup();
  }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (popup.classList.contains("visible")) positionPopup();
    });
    window.visualViewport.addEventListener("scroll", () => {
      if (popup.classList.contains("visible")) positionPopup();
    });
  }

  popup.addEventListener("wheel", (event) => {
    if (!popup.classList.contains("visible")) return;
    const atTop = popup.scrollTop <= 0;
    const atBottom = Math.ceil(popup.scrollTop + popup.clientHeight) >= popup.scrollHeight;
    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("click", (event) => {
    if (!inputs.includes(event.target) && !popup.contains(event.target)) {
      hidePopup();
    }
  });
})();
