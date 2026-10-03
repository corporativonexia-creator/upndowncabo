(function () {
  function applyProductConditions() {
    const select = document.getElementById("udCondition");
    if (!select) return false;

    const current = select.value;
    const normalized = current === "demo" ? "preowned" : current;

    select.innerHTML = `
      <option value="new">Nuevo</option>
      <option value="preowned">Semi nuevo</option>
      <option value="used">Usado</option>
      <option value="restored">Restaurado</option>
    `;

    const allowed = ["new", "preowned", "used", "restored"];
    select.value = allowed.includes(normalized) ? normalized : "new";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (!applyProductConditions()) {
    const observer = new MutationObserver(() => {
      if (applyProductConditions()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
