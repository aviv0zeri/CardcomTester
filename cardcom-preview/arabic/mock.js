/**
 * Local Cardcom mock. Never paste this file into Cardcom.
 *
 * Cardcom’s page is the same HTML/CSS we paste. Their Knockout runtime
 * plus wallet SDKs then fill labels, hide fields, and inject buttons.
 * This file is the localhost stand-in for that runtime, using the same
 * data-bind names, so preview matches their demo session.
 */
(function () {
  const LINES = [];
  for (let i = 1; i <= 20; i++) {
    const price = (i * 10).toFixed(2) + " ₪";
    LINES.push({
      name: "منتج تجريبي " + i,
      unitPrice: price,
      quantity: "1.00",
      total: price
    });
  }

  const vm = {
    IsHideInvoiceInfo: false,
    hidePayPal: false,
    hideMasterPass: true,
    hideApplePay: false,
    IsApplePayActive: true,
    hideUpayBitBtn: false,
    hidePayMeBitBtn: true,
    hideCardcomBitBtn: true,
    hideCreditCardInputs: false,
    hideNumberOfPayments: false,
    IsMobile: false,
    IsToken: false,
    IsRecaptchaActive: false,
    showCancelURL: false,
    HideFooter: false,
    ShowCookiesBanner: false,
    showCommissionSummery: false,
    showOriginalSum: false,
    showCoinConvert: false,
    DispCaptchaReqErr: false,
    loadMode: false,
    summaryTotalSign: "₪2,100.00",
    summaryTotalText: "المجموع ₪2,100.00",
    buttonText: "ادفع",
    lph1: "Enter Payment Information",
    lblExpiration: "الصلاحية",
    CardcomBitUrl: "",
    PayMePaymentText: "",
    PayMePaymentError: "",
    ShowPayMeCountdown: false,
    CardcomBitUrlText: "",
    CardcomBitPaymentText: "",
    CardcomBitPaymentError: "",
    ShowCardcomBitCountdown: false,
    CardcomBitQrBarcodeUrl: "",
    cancelURL: "#",
    images: {
      paypal: "../assets/paypal.svg",
      masterPass: "../assets/masterpass.svg",
      cardcomLogoEn: "https://secure.cardcom.solutions/Images/cardcomLogoEn.png"
    },
    labels: {
      HtmlComments: "",
      Summary: "المجموع",
      MethodsOfPayment: "وسائل الدفع",
      PayByCreditCard: "PAY BY CREDIT CARD",
      InvoiceInfo: "بيانات الفاتورة",
      MoreDetails: "تفاصيل إضافية",
      LinkBackToSite: "العودة إلى الموقع",
      FooterTextTop:
        'يتم الدفع عبر Cardcom - <a href="https://www.cardcom.co.il/" target="_blank">مقاصة بطاقات الائتمان للشركات</a> وفق أعلى معايير الأمان ووفقاً لـ <a href="#">سياسة الخصوصية</a>',
      FooterTextBottom: "",
      PaymentDoneWithTheStrictestSecurityStandards: "الدفع مؤمَّن وفق معايير PCI"
    },
    order: {
      name: "الوصف",
      unitPrice: "سعر الوحدة",
      quantity: "الكمية",
      total: "المجموع",
      showInvoiceHead: true,
      lines: LINES,
      custName: { hide: false, label: "إلى", value: "عميل تجريبي" },
      compID: { hide: false, label: "رقم الهوية / الشركة", value: "" },
      custCity: { hide: false, label: "المدينة", value: "" },
      custAddresLine1: { hide: false, label: "الشارع", value: "" },
      custAddresLine2: { hide: false, label: "الرمز البريدي / صندوق البريد", value: "" },
      custMobilePH: { hide: false, label: "الجوال", value: "" },
      custLinePH: { hide: false, label: "هاتف إضافي", value: "" },
      email: { hide: false, label: "البريد الإلكتروني", value: "" }
    },
    cardNumber: { hide: false, label: "رقم البطاقة", value: "", disabled: false },
    cvv: { hide: false, label: "3 أرقام على ظهر البطاقة", value: "" },
    cardOwnerID: { hide: false, label: "هوية حامل البطاقة", value: "" },
    cardOwnerName: { hide: false, label: "اسم حامل البطاقة", value: "" },
    cardOwnerPhone: { hide: true, label: "الجوال", value: "" },
    cardOwnerEmail: { hide: true, label: "البريد الإلكتروني", value: "" },
    openSum: { hide: true, label: "المبلغ للدفع", value: "" },
    numberOfPayments: {
      hide: false,
      label: "عدد الدفعات",
      value: "1",
      selectValues: ["1", "2", "3", "4", "6", "12"]
    },
    expirationYear: {
      label: "Year",
      value: "2026",
      disabled: false,
      selectValues: ["2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033", "2034", "2035", "2036"]
    },
    expirationMonth: { label: "Month", value: "1", disabled: false },
    condition: {
      hide: false,
      label: "لقد قرأت وأوافق على شروط الاستخدام",
      value: "#",
      booleanValue: false
    },
    customFields: [],
    error: { hasMessages: false, messages: [] },
    ApplePay: {
      language: "ar",
      isApplePayExt: false,
      AddPaddingBelowComponent: false,
      applePayInstance: {
        flagsComputed: {
          _SetupBtn: false,
          _PaymentBtn: true,
          _PopupBtn: false
        }
      }
    }
  };

  function get(path) {
    const parts = String(path).replace(/\(\)/g, "").split(".");
    let cur = vm;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === "function" ? cur.call(vm) : cur;
  }

  function truthy(expr) {
    let e = String(expr || "").trim();
    if (!e) return false;
    e = e.replace(/[A-Za-z_][\w.]*(?:\(\))?/g, function (id) {
      const path = id.replace(/\(\)$/, "");
      if (path === "true" || path === "false") return path;
      const v = get(path);
      if (typeof v === "number") return String(v);
      if (typeof v === "string") return JSON.stringify(v);
      return v ? "true" : "false";
    });
    try {
        return !!Function('"use strict"; return (' + e + ")")();
    } catch (err) {
      return false;
    }
  }

  function bindParts(attr) {
    const chunks = [];
    let depth = 0;
    let cur = "";
    const s = String(attr || "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (ch === "," && depth === 0) {
        chunks.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) chunks.push(cur);
    const parts = [];
    chunks.forEach(function (chunk) {
      const m = chunk.match(/^\s*(ifnot|if|hide|visible|text|html|value|attr|click|checked|options|disable|enable|css|style|event|class)\s*:\s*(.*)$/);
      if (m) parts.push({ type: m[1], expr: m[2].trim() });
    });
    return parts;
  }

  function applyVisibility(root) {
    root.querySelectorAll("[data-bind]").forEach(function (el) {
      const parts = bindParts(el.getAttribute("data-bind"));
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.type === "if" && !truthy(p.expr)) {
          el.remove();
          return;
        }
        if (p.type === "ifnot" && truthy(p.expr)) {
          el.remove();
          return;
        }
        if (p.type === "hide" && truthy(p.expr)) {
          el.style.display = "none";
        }
        if (p.type === "visible" && !truthy(p.expr)) {
          el.style.display = "none";
        }
      }
    });
  }

  function fillBinds(root) {
    root.querySelectorAll("[data-bind]").forEach(function (el) {
      const parts = bindParts(el.getAttribute("data-bind"));
      parts.forEach(function (p) {
        if (p.type === "text" || p.type === "html") {
          const v = get(p.expr);
          if (v == null || v === "") return;
          el.innerHTML = String(v);
        }
        if (p.type === "value") {
          const v = get(p.expr);
          if (v == null) return;
          if (el.tagName === "INPUT" || el.tagName === "SELECT") el.value = String(v);
        }
        if (p.type === "attr") {
          const src = p.expr.match(/src\s*:\s*([^}\s,]+)/);
          if (src) {
            const v = get(src[1]);
            if (v) el.setAttribute("src", v);
          }
          const lang = p.expr.match(/lang\s*:\s*([^}\s,]+)/);
          if (lang) {
            const v = get(lang[1]);
            if (v) el.setAttribute("lang", String(v));
          }
        }
        if (p.type === "options") {
          const list = get(p.expr);
          if (!Array.isArray(list) || el.tagName !== "SELECT") return;
          if (el.options.length) return;
          list.forEach(function (item) {
            el.appendChild(new Option(String(item), String(item)));
          });
        }
      });
    });
  }

  function fillLines(root) {
    const body = root.querySelector(".productsTbl tbody");
    if (!body) return;
    body.innerHTML = vm.order.lines.map(function (line) {
      return (
        "<tr>" +
        '<td class="align"><span>' + line.name + "</span></td>" +
        '<td><span class="directionLTR">' + line.unitPrice + "</span></td>" +
        '<td><span class="directionLTR">' + line.quantity + "</span></td>" +
        '<td><span class="directionLTR">' + line.total + "</span></td>" +
        "</tr>"
      );
    }).join("");
  }

  function applyCardcomHost(root) {
    // Cardcom wraps pasted HTML in #Content. Live Low Profile computed Arial
    // on our paste, not stock Tahoma. Do not force Tahoma. Preview-only.
    if (!document.getElementById("Content")) {
      const content = document.createElement("div");
      content.id = "Content";
      content.setAttribute("style", "display:block;width:100%;overflow-x:hidden;");
      while (root.firstChild) content.appendChild(root.firstChild);
      root.appendChild(content);
    }
    if (document.getElementById("cardcom-host-mock")) return;
    const style = document.createElement("style");
    style.id = "cardcom-host-mock";
    style.textContent = [
      "html, body { font-size: 16px; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }",
      "body, body * { font-family: Arial, Helvetica, sans-serif !important; }",
      "#Content { zoom: 1; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function injectWallets(root) {
    const gpay = root.querySelector("#GooglePayDiv");
    if (gpay && !gpay.querySelector(".preview-wallet")) {
      const b = document.createElement("div");
      b.className = "preview-wallet google";
      b.setAttribute("aria-hidden", "true");
      gpay.appendChild(b);
    }
    const apple = root.querySelector("#apple-pay-button-start");
    if (apple && apple.style.display !== "none") {
      apple.classList.add("preview-wallet", "apple");
    }
    const month = root.querySelector("#validityMonth");
    if (month) month.value = vm.expirationMonth.value;
  }

  fetch("../../templates/cardcom/low-profile/checkout.html?v=lph1")
    .then(function (res) {
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    })
    .then(function (html) {
      const root = document.getElementById("checkout-root");
      root.innerHTML = html;
      applyVisibility(root);
      fillBinds(root);
      fillLines(root);
      injectWallets(root);
      applyCardcomHost(root);
    })
    .catch(function (err) {
      document.getElementById("checkout-root").textContent =
        "Could not load templates/cardcom/low-profile/checkout.html. Serve the repo root so the fetch path works. " +
        err;
    });
})();
