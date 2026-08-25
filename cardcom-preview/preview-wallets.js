/**
 * Local preview only. Never paste this file into Cardcom.
 *
 * Simulates Knockout hiding wallets so the production 2-column grid
 * can be checked with 4, 3, 2, or 1 visible methods. Does not replace
 * Cardcom containers or change mock.js.
 *
 * Use the toolbar, or ?wallets=4|3|2|1
 */
(function () {
  var PRESETS = {
    4: [],
    3: [".ApplePayDiv", "#ApplePayDivContainer"],
    2: [
      ".ApplePayDiv",
      "#ApplePayDivContainer",
      "#uPayBitDiv",
      "#PayMeBitDiv",
      "#CardcomBitDiv",
      "#BitDivContainer"
    ],
    1: [
      ".ApplePayDiv",
      "#ApplePayDivContainer",
      "#uPayBitDiv",
      "#PayMeBitDiv",
      "#CardcomBitDiv",
      "#BitDivContainer",
      ".paypalDiv",
      ".masterPassDiv"
    ]
  };

  var current = 4;

  function requestedCount() {
    var n = parseInt(new URLSearchParams(location.search).get("wallets") || "4", 10);
    return PRESETS[n] ? n : 4;
  }

  function apply(count) {
    current = PRESETS[count] ? count : 4;
    document.querySelectorAll(".preview-wallet-off").forEach(function (el) {
      el.classList.remove("preview-wallet-off");
    });
    PRESETS[current].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.classList.add("preview-wallet-off");
      });
    });
    document.querySelectorAll("[data-preview-wallets]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-preview-wallets") === String(current) ? "true" : "false");
    });
  }

  function mountBar() {
    if (document.getElementById("preview-wallet-bar")) return;
    var bar = document.createElement("div");
    bar.id = "preview-wallet-bar";
    bar.innerHTML =
      '<span>Wallets</span>' +
      [4, 3, 2, 1].map(function (n) {
        return (
          '<button type="button" data-preview-wallets="' +
          n +
          '">' +
          n +
          "</button>"
        );
      }).join("");
    bar.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-preview-wallets]");
      if (!btn) return;
      var n = parseInt(btn.getAttribute("data-preview-wallets"), 10);
      var url = new URL(location.href);
      url.searchParams.set("wallets", String(n));
      history.replaceState(null, "", url);
      apply(n);
    });
    document.body.appendChild(bar);
  }

  function sync() {
    if (!document.querySelector(".payment-methods-grid")) return false;
    mountBar();
    apply(requestedCount());
    return true;
  }

  if (sync()) return;
  var obs = new MutationObserver(function () {
    if (sync()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
