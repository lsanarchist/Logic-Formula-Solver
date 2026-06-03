(function () {
  var btn = document.getElementById("help-tab-btn");
  var panel = document.getElementById("help-panel");
  if (!btn || !panel) return;

  btn.addEventListener("click", function () {
    var opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
    btn.setAttribute("aria-expanded", opening ? "true" : "false");

    if (opening) {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
})();
