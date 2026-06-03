(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const NODE_R = 26;
  const X_GAP = 92;
  const Y_GAP = 105;
  const SYMBOLS = {
    and: "∧",
    or: "∨",
    imp: "→",
    iff: "↔",
    not: "¬",
    neg: "¬",
    true: "⊤",
    false: "⊥",
  };

  function readJson(root, selector, fallback) {
    const script = root.querySelector(selector);
    if (!script) return fallback;
    try {
      return JSON.parse(script.textContent || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function sym(value) {
    return SYMBOLS[value] || value;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    return node;
  }

  function htmlEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function flattenTree(data) {
    let leafIndex = 0;
    const nodes = [];
    const links = [];

    function walk(raw, depth = 0, parent = null, id = "0") {
      const node = {
        id,
        label: String(raw.label ?? "?"),
        type: raw.type === "leaf" ? "leaf" : "node",
        var: raw.var || null,
        depth,
        children: [],
        x: 0,
        y: depth * Y_GAP,
      };
      nodes.push(node);
      if (parent) links.push({ source: parent, target: node });

      const children = Array.isArray(raw.children) ? raw.children : [];
      for (const [index, child] of children.entries()) {
        node.children.push(walk(child, depth + 1, node, `${id}.${index}`));
      }

      if (!node.children.length) {
        node.x = leafIndex * X_GAP;
        leafIndex += 1;
      } else {
        node.x = node.children.reduce((sum, child) => sum + child.x, 0) / node.children.length;
      }
      return node;
    }

    const root = walk(data);
    return { root, nodes, links };
  }

  function bounds(nodes) {
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    return {
      minX: Math.min(...xs) - NODE_R * 2,
      maxX: Math.max(...xs) + NODE_R * 2,
      minY: Math.min(...ys) - NODE_R * 3,
      maxY: Math.max(...ys) + NODE_R * 2,
    };
  }

  function linkPath(link) {
    const sx = link.source.x;
    const sy = link.source.y;
    const tx = link.target.x;
    const ty = link.target.y;
    const midY = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${midY} ${tx},${midY} ${tx},${ty}`;
  }

  function renderTree(root) {
    const data = readJson(root, ".tree-data", null);
    if (!data) return;

    const info = readJson(root, ".tree-info", {});
    const showInfoPanel = root.dataset.showInfo === "true";
    root.innerHTML = "";

    const svg = svgEl("svg", { role: "img" });
    const graph = svgEl("g");
    svg.appendChild(graph);
    root.appendChild(svg);

    const tip = htmlEl("div", "tree-tip");
    root.appendChild(tip);

    let panel = null;
    if (showInfoPanel) {
      panel = htmlEl("div", "tree-panel");
      panel.innerHTML = "<h4>Node Details</h4>";
      root.appendChild(panel);
    }

    const controls = htmlEl("div", "tree-controls");
    const resetButton = htmlEl("button", "", "Reset");
    const zoomInButton = htmlEl("button", "", "+");
    const zoomOutButton = htmlEl("button", "", "-");
    controls.append(resetButton, zoomInButton, zoomOutButton);
    root.appendChild(controls);

    let model = flattenTree(data);
    let transform = { x: 0, y: 0, k: 1 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let selectedVar = null;

    function setTransform(next) {
      transform = next;
      graph.setAttribute("transform", `translate(${transform.x},${transform.y}) scale(${transform.k})`);
    }

    function fit() {
      model = flattenTree(data);
      const rect = root.getBoundingClientRect();
      const w = Math.max(rect.width, 320);
      const h = Math.max(rect.height, 320);
      const box = bounds(model.nodes);
      const treeW = Math.max(1, box.maxX - box.minX);
      const treeH = Math.max(1, box.maxY - box.minY);
      const scale = Math.min((w - 72) / treeW, (h - 88) / treeH, 1.25);
      const x = (w - treeW * scale) / 2 - box.minX * scale;
      const y = (h - treeH * scale) / 2 - box.minY * scale;
      setTransform({ x, y, k: scale });
      draw();
    }

    function showTip(event, node) {
      const label = node.type === "leaf"
        ? `variable: ${node.label}`
        : `operator: ${sym(node.label)}`;
      tip.textContent = node.var ? `${label} | ${node.var}` : label;
      tip.style.display = "block";
      moveTip(event);
    }

    function moveTip(event) {
      const rect = root.getBoundingClientRect();
      tip.style.left = `${event.clientX - rect.left + 12}px`;
      tip.style.top = `${event.clientY - rect.top - 8}px`;
    }

    function hideTip() {
      tip.style.display = "none";
    }

    function renderPanel(node) {
      if (!panel || !node.var) return;
      const details = info[node.var] || {};
      selectedVar = node.var;
      panel.innerHTML = `
        <h4>${esc(node.var)}</h4>
        <strong>Equivalence</strong>
        <pre>${esc(details.equivalence || "No equivalence available.")}</pre>
        <strong>Local clauses</strong>
        <pre>${esc(details.clauses || "No local clauses available.")}</pre>
      `;
      draw();
    }

    function draw() {
      graph.innerHTML = "";

      for (const link of model.links) {
        graph.appendChild(svgEl("path", {
          class: "tree-edge",
          d: linkPath(link),
        }));
      }

      for (const node of model.nodes) {
        const group = svgEl("g", {
          class: `tree-node ${node.type === "leaf" ? "leaf" : "op"}`,
          transform: `translate(${node.x},${node.y})`,
        });

        const circle = svgEl("circle", { r: NODE_R });
        if (selectedVar && node.var === selectedVar) {
          circle.setAttribute("stroke-width", "4");
        }
        group.appendChild(circle);

        const text = svgEl("text", { y: 1 });
        text.textContent = node.type === "leaf" ? node.label : sym(node.label);
        group.appendChild(text);

        if (node.var) {
          const width = Math.max(34, node.var.length * 8 + 14);
          group.appendChild(svgEl("rect", {
            class: "tree-badge",
            x: -width / 2,
            y: -(NODE_R + 24),
            width,
            height: 18,
            rx: 6,
          }));
          const badgeText = svgEl("text", {
            class: "tree-badge-text",
            y: -(NODE_R + 15),
          });
          badgeText.textContent = node.var;
          group.appendChild(badgeText);
        }

        group.addEventListener("mouseenter", (event) => showTip(event, node));
        group.addEventListener("mousemove", moveTip);
        group.addEventListener("mouseleave", hideTip);
        group.addEventListener("click", (event) => {
          event.stopPropagation();
          if (showInfoPanel && node.type !== "leaf") renderPanel(node);
        });
        graph.appendChild(group);
      }
    }

    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 1.12 : 0.88;
      const nextK = Math.min(4, Math.max(0.18, transform.k * delta));
      const ratio = nextK / transform.k;
      setTransform({
        k: nextK,
        x: mx - (mx - transform.x) * ratio,
        y: my - (my - transform.y) * ratio,
      });
    }, { passive: false });

    svg.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".tree-node")) return;
      isPanning = true;
      panStart = {
        x: event.clientX - transform.x,
        y: event.clientY - transform.y,
      };
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener("pointermove", (event) => {
      if (!isPanning) return;
      setTransform({
        ...transform,
        x: event.clientX - panStart.x,
        y: event.clientY - panStart.y,
      });
    });

    svg.addEventListener("pointerup", () => {
      isPanning = false;
    });

    svg.addEventListener("click", () => {
      if (panel && !selectedVar) {
        panel.innerHTML = "<h4>Node Details</h4>";
      }
    });

    resetButton.addEventListener("click", fit);
    zoomInButton.addEventListener("click", () => setTransform({ ...transform, k: Math.min(4, transform.k * 1.2) }));
    zoomOutButton.addEventListener("click", () => setTransform({ ...transform, k: Math.max(0.18, transform.k / 1.2) }));

    new ResizeObserver(fit).observe(root);
    fit();
  }

  window.renderFormulaTrees = function renderFormulaTrees() {
    document.querySelectorAll(".tree-visual").forEach(renderTree);
  };

  document.addEventListener("DOMContentLoaded", window.renderFormulaTrees);
})();
