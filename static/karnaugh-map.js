(() => {
  const MAX_CELL = 76;
  const MIN_CELL = 58;

  function readData(root) {
    if (root.__kmapData) return root.__kmapData;
    const script = root.querySelector(".kmap-data");
    if (!script) return null;
    try {
      root.__kmapData = JSON.parse(script.textContent || "null");
      return root.__kmapData;
    } catch {
      return null;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function withAlpha(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function hexToRgb(hex) {
    const value = String(hex || "").replace("#", "").trim();
    if (![3, 6].includes(value.length)) return null;
    const normalized = value.length === 3
      ? value.split("").map((char) => char + char).join("")
      : value;
    const parsed = Number.parseInt(normalized, 16);
    if (Number.isNaN(parsed)) return null;
    return [
      (parsed >> 16) & 255,
      (parsed >> 8) & 255,
      parsed & 255,
    ];
  }

  function renderKmap(root) {
    const data = readData(root);
    if (!data) return;

    const title = root.dataset.title || "Karnaugh Map";
    const availableWidth = Math.max(260, root.clientWidth - 34);
    const columnCount = data.cols + 1;
    const cellSize = Math.max(
      MIN_CELL,
      Math.min(MAX_CELL, Math.floor(availableWidth / columnCount))
    );
    root.innerHTML = "";

    const panel = el("div", "kmap-panel");
    root.appendChild(panel);

    const header = el("div", "kmap-header");
    const titleBlock = el("div");
    titleBlock.appendChild(el("div", "kmap-title", title));
    titleBlock.appendChild(
      el(
        "div",
        "kmap-subtitle",
        `Columns: ${data.col_vars.length ? data.col_vars.join(", ") : "-"} | Rows: ${data.row_vars.length ? data.row_vars.join(", ") : "-"}`
      )
    );
    header.appendChild(titleBlock);

    const legend = el("div", "kmap-legend");
    for (const group of data.groups || []) {
      const chip = el("div", "kmap-chip");
      chip.style.borderColor = withAlpha(group.color, 0.44);
      const swatch = el("span", "kmap-chip-swatch");
      swatch.style.background = group.color;
      chip.appendChild(swatch);
      chip.appendChild(el("strong", "", group.id));
      chip.appendChild(el("span", "", group.expression));
      legend.appendChild(chip);
    }
    header.appendChild(legend);
    panel.appendChild(header);

    const layout = el("div", "kmap-layout");
    panel.appendChild(layout);

    const side = el("div", "kmap-side-note");
    side.appendChild(el("div", "", `Focus value: ${data.focus_value}`));
    side.appendChild(el("div", "", `Gray columns: ${data.col_labels.join(", ")}`));
    side.appendChild(el("div", "", `Gray rows: ${data.row_labels.join(", ")}`));
    layout.appendChild(side);

    const wrap = el("div", "kmap-grid-wrap");
    layout.appendChild(wrap);

    const grid = el("div", "kmap-grid");
    grid.style.setProperty("--kmap-cell", `${cellSize}px`);
    grid.style.gridTemplateColumns = `repeat(${columnCount}, ${cellSize}px)`;
    wrap.appendChild(grid);

    const corner = el("div", "kmap-corner");
    corner.appendChild(el("span", "", `Cols: ${data.col_vars.join(", ") || "-"}`));
    corner.appendChild(el("span", "", `Rows: ${data.row_vars.join(", ") || "-"}`));
    grid.appendChild(corner);

    for (const label of data.col_labels) {
      grid.appendChild(el("div", "kmap-col-head", label));
    }

    for (let rowIndex = 0; rowIndex < data.rows; rowIndex += 1) {
      grid.appendChild(el("div", "kmap-row-head", data.row_labels[rowIndex]));
      for (let colIndex = 0; colIndex < data.cols; colIndex += 1) {
        const cell = data.cells.find((item) => item.row === rowIndex && item.col === colIndex);
        const cellEl = el("div", "kmap-cell");
        cellEl.dataset.value = cell.value;
        cellEl.dataset.row = String(rowIndex);
        cellEl.dataset.col = String(colIndex);
        cellEl.appendChild(el("span", "kmap-cell-value", cell.value));
        cellEl.appendChild(el("span", "kmap-index", cell.index));
        grid.appendChild(cellEl);
      }
    }

    const stage = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    stage.classList.add("kmap-stage");
    stage.setAttribute("width", String(data.cols * cellSize));
    stage.setAttribute("height", String(data.rows * cellSize));
    stage.setAttribute("viewBox", `0 0 ${data.cols * cellSize} ${data.rows * cellSize}`);
    stage.style.left = `${cellSize}px`;
    stage.style.top = `${cellSize}px`;
    stage.style.width = `${data.cols * cellSize}px`;
    stage.style.height = `${data.rows * cellSize}px`;
    grid.appendChild(stage);

    for (const [groupIndex, group] of (data.groups || []).entries()) {
      const lane = groupIndex % 3;
      const inset = 5 + lane * 2;
      const radius = 12 - lane;
      for (const rect of group.rects || []) {
        const x = rect.col_start * cellSize + inset;
        const y = rect.row_start * cellSize + inset;
        const width = (rect.col_end - rect.col_start + 1) * cellSize - inset * 2;
        const height = (rect.row_end - rect.row_start + 1) * cellSize - inset * 2;
        if (width <= 0 || height <= 0) continue;

        const fill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        fill.setAttribute("x", String(x));
        fill.setAttribute("y", String(y));
        fill.setAttribute("width", String(width));
        fill.setAttribute("height", String(height));
        fill.setAttribute("rx", String(radius));
        fill.setAttribute("fill", withAlpha(group.color, 0.12));
        fill.setAttribute("stroke", "none");
        stage.appendChild(fill);

        const outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        outline.setAttribute("x", String(x));
        outline.setAttribute("y", String(y));
        outline.setAttribute("width", String(width));
        outline.setAttribute("height", String(height));
        outline.setAttribute("rx", String(radius));
        outline.setAttribute("fill", "none");
        outline.setAttribute("stroke", group.color);
        outline.setAttribute("stroke-width", String(3 - lane * 0.35));
        outline.setAttribute("stroke-linejoin", "round");
        stage.appendChild(outline);
      }
    }

    panel.appendChild(
      el(
        "p",
        "kmap-foot",
        `Colored outlines correspond to groups in the current ${String(data.normal_form).toUpperCase()} result.`
      )
    );

    if (!root.__kmapResizeObserver && "ResizeObserver" in window) {
      root.__kmapResizeObserver = new ResizeObserver(() => {
        window.clearTimeout(root.__kmapResizeTimer);
        root.__kmapResizeTimer = window.setTimeout(() => renderKmap(root), 80);
      });
      root.__kmapResizeObserver.observe(root);
    }
  }

  window.renderKarnaughMaps = function renderKarnaughMaps() {
    document.querySelectorAll(".kmap").forEach(renderKmap);
  };

  document.addEventListener("DOMContentLoaded", window.renderKarnaughMaps);
})();
