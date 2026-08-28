/**
 * Local preview only. Never paste this file into Cardcom.
 *
 * Simulates Knockout hiding wallets so the production 2-column grid
 * can be checked with 4, 3, 2, or 1 visible methods. Does not replace
 * Cardcom containers or change mock.js.
 *
 * Use ?wallets=4|3|2|1 to pick the preset. The floating toolbar is opt-in
 * only (?walletBar=1) -- it stays off by default so it doesn't sit in the
 * phone-sized preview's chin/safe-area during normal testing.
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

  function showApplePayStandIn() {
    // mock.js's binding parser trips on Cardcom's "//hide:" comment inside the
    // apple-pay-button-start binding and hides the button. Live Safari shows it.
    // Restore the stand-in here (mock.js is frozen).
    var btn = document.querySelector("#apple-pay-button-start");
    if (!btn) return;
    btn.style.display = "";
    btn.classList.add("preview-wallet", "apple");
  }

  function apply(count) {
    current = PRESETS[count] ? count : 4;
    showApplePayStandIn();
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

  function applyBillingParam() {
    // ?billing=0 simulates order.showInvoiceHead === false (Knockout would
    // write inline display:none on .checkout-order). Preview only.
    if (new URLSearchParams(location.search).get("billing") !== "0") return;
    var order = document.querySelector(".checkout-order");
    if (order) order.style.display = "none";
  }

  function wantsBar() {
    return new URLSearchParams(location.search).get("walletBar") === "1";
  }

  function sync() {
    if (!document.querySelector(".payment-methods-grid")) return false;
    if (wantsBar()) mountBar();
    apply(requestedCount());
    applyBillingParam();
    return true;
  }

  if (sync()) return;
  var obs = new MutationObserver(function () {
    if (sync()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
