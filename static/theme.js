(() => {
  const STORAGE_KEY = "logic-theme";
  const choices = Array.from(document.querySelectorAll("[data-theme-choice]"));
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function savedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch {
      return "system";
    }
  }

  function effectiveTheme(theme) {
    if (theme === "light" || theme === "dark") return theme;
    return media.matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const normalized = ["system", "light", "dark"].includes(theme) ? theme : "system";
    document.documentElement.dataset.theme = normalized;
    document.documentElement.dataset.effectiveTheme = effectiveTheme(normalized);
    for (const button of choices) {
      const selected = button.dataset.themeChoice === normalized;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  for (const button of choices) {
    button.addEventListener("click", () => {
      const nextTheme = button.dataset.themeChoice || "system";
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // Ignore storage failures; the theme still updates for this page load.
      }
      applyTheme(nextTheme);
    });
  }

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", () => applyTheme(savedTheme()));
  } else if (typeof media.addListener === "function") {
    media.addListener(() => applyTheme(savedTheme()));
  }

  applyTheme(savedTheme());
})();
