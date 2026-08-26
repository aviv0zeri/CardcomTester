/**
 * Local HTML+CSS preview for a paste version. Never paste this file into Cardcom.
 * Open via cardcom_open or /cardcom-preview/open.html?v=low-profile/he
 */
(function () {
  var SHARED_HTML = "/templates/cardcom/low-profile/checkout.html";
  var RTL_CSS = "/templates/cardcom/low-profile/rtl/checkout.css";
  var LTR_CSS = "/templates/cardcom/low-profile/ltr/checkout.css";
  var VERSIONS = {
    "low-profile/he": {
      dir: "rtl",
      lang: "he",
      mock: "/cardcom-preview/mock.js",
      base: "/cardcom-preview/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        RTL_CSS,
        "/cardcom-preview/preview.css"
      ]
    },
    "low-profile/en": {
      dir: "ltr",
      lang: "en",
      mock: "/cardcom-preview/english/mock.js",
      base: "/cardcom-preview/english/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        LTR_CSS,
        "/cardcom-preview/preview.css"
      ]
    },
    "low-profile/ar": {
      dir: "rtl",
      lang: "ar",
      mock: "/cardcom-preview/arabic/mock.js",
      base: "/cardcom-preview/arabic/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        RTL_CSS,
        "/cardcom-preview/preview.css"
      ]
    },
    "low-profile/ru": {
      dir: "ltr",
      lang: "ru",
      mock: "/cardcom-preview/russian/mock.js",
      base: "/cardcom-preview/russian/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        LTR_CSS,
        "/cardcom-preview/preview.css"
      ]
    },
    "low-profile/he/embed": {
      dir: "rtl",
      lang: "he",
      mock: "/cardcom-preview/mock.js",
      base: "/cardcom-preview/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        RTL_CSS,
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    },
    "low-profile/en/embed": {
      dir: "ltr",
      lang: "en",
      mock: "/cardcom-preview/english/mock.js",
      base: "/cardcom-preview/english/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        LTR_CSS,
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    },
    "low-profile/ar/embed": {
      dir: "rtl",
      lang: "ar",
      mock: "/cardcom-preview/arabic/mock.js",
      base: "/cardcom-preview/arabic/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        RTL_CSS,
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    },
    "low-profile/ru/embed": {
      dir: "ltr",
      lang: "ru",
      mock: "/cardcom-preview/russian/mock.js",
      base: "/cardcom-preview/russian/",
      html: SHARED_HTML,
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        LTR_CSS,
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    },
    "competition-template": {
      dir: "rtl",
      lang: "he",
      mock: "/cardcom-preview/mock.js",
      base: "/cardcom-preview/",
      html: "/competition-template/checkout.html",
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        "/competition-template/checkout.css"
      ]
    },
    "low-profile/_archive/english-full-snapshot": {
      dir: "ltr",
      lang: "en",
      mock: "/cardcom-preview/english-full/mock.js",
      base: "/cardcom-preview/english-full/",
      html: "/templates/cardcom/low-profile/_archive/english-full-snapshot/iframe.html",
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        "/templates/cardcom/low-profile/_archive/english-full-snapshot/checkout.css",
        "/cardcom-preview/preview.css"
      ]
    },
    "low-profile/_archive/old-separate-iframe/he": {
      dir: "rtl",
      lang: "he",
      mock: "/cardcom-preview/mock.js",
      base: "/cardcom-preview/",
      html: "/templates/cardcom/low-profile/_archive/old-separate-iframe/he/iframe.html",
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        "/templates/cardcom/low-profile/_archive/old-separate-iframe/he/checkout.css",
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    },
    "low-profile/_archive/old-separate-iframe/en": {
      dir: "ltr",
      lang: "en",
      mock: "/cardcom-preview/english/mock.js",
      base: "/cardcom-preview/english/",
      html: "/templates/cardcom/low-profile/_archive/old-separate-iframe/en/iframe.html",
      css: [
        "/cardcom-hosted/templates/cardcom-stock.css",
        "/templates/cardcom/low-profile/_archive/old-separate-iframe/en/checkout.css",
        "/cardcom-preview/preview.css",
        "/cardcom-preview/preview-iframe.css"
      ]
    }
  };

  var aliases = {
    "low-profile/rtl": "low-profile/he",
    "low-profile/ltr": "low-profile/en",
    "low-profile/full/redirect/he": "low-profile/he",
    "low-profile/full/redirect/en": "low-profile/en",
    "low-profile/full/iframe/he": "low-profile/he/embed",
    "low-profile/full/iframe/en": "low-profile/en/embed",
    "redirect-normal/hebrew": "low-profile/he",
    "redirect-normal/english": "low-profile/en",
    "iframe-normal/hebrew": "low-profile/he/embed",
    "iframe-normal/english": "low-profile/en/embed",
    "redirect-normal/english-full": "low-profile/_archive/english-full-snapshot",
    "long/redirect-normal/hebrew": "low-profile/he",
    "long/redirect-normal/english": "low-profile/en",
    "long/iframe-normal/hebrew": "low-profile/he/embed",
    "long/iframe-normal/english": "low-profile/en/embed",
    "long/redirect-normal/english-full": "low-profile/_archive/english-full-snapshot"
  };

  var params = new URLSearchParams(location.search);
  var key = params.get("v") || "low-profile/he";
  if (aliases[key]) key = aliases[key];
  if (params.get("embed") === "1" && VERSIONS[key + "/embed"]) {
    key = key + "/embed";
  }
  var spec = VERSIONS[key];

  // &brand=1 — compact Aviv skin (logo, name, card fields). Not Canaan, not paste.
  // &all=1 / &wip=1 — working copies under templates/cardcom/low-profile/.
  if (spec && spec.html.indexOf("/competition-template/") === -1) {
    if (params.get("brand") === "1") {
      spec = {
        dir: spec.dir,
        lang: spec.lang,
        mock: spec.mock,
        base: spec.base,
        html: "/templates/cardcom/low-profile/_brand/checkout.html",
        css: spec.css.concat([
          "/templates/cardcom/low-profile/_brand/brand-skin.css"
        ])
      };
    } else if (params.get("all") === "1" || params.get("wip") === "1") {
      var folder = params.get("all") === "1" ? "_all" : "_wip";
      var toCopy = function (p) {
        return p.replace(
          "/templates/cardcom/low-profile/",
          "/templates/cardcom/low-profile/" + folder + "/"
        );
      };
      spec = {
        dir: spec.dir,
        lang: spec.lang,
        mock: spec.mock,
        base: spec.base,
        html: toCopy(spec.html),
        css: spec.css.map(toCopy)
      };
    }
  }
  var root = document.getElementById("checkout-root");
  if (!spec) {
    root.textContent = "Unknown version: " + key;
    return;
  }

  document.documentElement.lang = spec.lang;
  document.documentElement.dir = spec.dir;
  if (key.indexOf("/embed") !== -1) {
    document.documentElement.classList.add("checkout-embed");
  }
  document.title = "Cardcom local — " + key;

  function remarkRow(title, body) {
    var tr = document.createElement("tr");
    tr.className = "invoice-line-remark";
    var td = document.createElement("td");
    td.className = "align";
    td.colSpan = 4;
    var box = document.createElement("div");
    box.className = "invoice-line-remark-box";
    var titleEl = document.createElement("div");
    titleEl.className = "invoice-line-remark-title";
    titleEl.textContent = title;
    var bodyEl = document.createElement("div");
    bodyEl.className = "invoice-line-remark-body";
    bodyEl.textContent = body;
    box.appendChild(titleEl);
    box.appendChild(bodyEl);
    td.appendChild(box);
    tr.appendChild(td);
    return tr;
  }

  var PREVIEW_COPY = {
    he: {
      remarkTitle: "הערות בשורה לחשבונית",
      remarkBody:
        "הלקוח ביקש חשבונית מס קבלה על שם העסק, כולל פירוט מק\"ט בכל שורה. אם הסכום חורג מ־₪2,000 יש לפצל לשתי חשבוניות ולציין את מספר ההזמנה המקורי בהערות. טקסט ארוך בכוונה כדי לבדוק גלילה בתוך התא כשההערה חורגת משתי שורות. שורה נוספת: איסוף מהמחסן רק אחרי אישור טלפוני, וצירוף תעודת משלוח חתומה.",
      privacy: "למדיניות הפרטיות של בית העסק"
    },
    en: {
      remarkTitle: "Invoice line remarks",
      remarkBody:
        "Customer asked for a tax invoice in the company name, with SKU on every line. If the amount exceeds ₪2,000 split into two invoices and quote the original order number. Long on purpose so the cell scrolls when the note runs past two lines. Extra: warehouse pickup only after a phone confirmation, and attach a signed delivery note.",
      privacy: "The business's privacy policy"
    },
    ar: {
      remarkTitle: "ملاحظات سطر الفاتورة",
      remarkBody:
        "طلب العميل فاتورة ضريبية باسم النشاط، مع رقم الصنف في كل سطر. إذا تجاوز المبلغ ₪2,000 يُقسَم إلى فاتورتين مع ذكر رقم الطلب الأصلي. نص طويل عمداً لاختبار التمرير داخل الخلية. إضافي: الاستلام من المستودع بعد تأكيد هاتفي وإرفاق بوليصة موقعة.",
      privacy: "سياسة خصوصية النشاط التجاري"
    },
    ru: {
      remarkTitle: "Примечания к строке счёта",
      remarkBody:
        "Клиент просил налоговый счёт на имя компании, с артикулом в каждой строке. Если сумма больше ₪2,000 — разбить на два счета и указать исходный номер заказа. Длинный текст специально, чтобы ячейка прокручивалась. Дополнительно: самовывоз со склада только после звонка и с подписанной накладной.",
      privacy: "Политика конфиденциальности бизнеса"
    }
  };

  function addInvoiceLineRemark() {
    var body = document.querySelector(".productsTbl tbody");
    if (!body || body.querySelector("[data-bind]") || !body.querySelector("tr")) return;
    if (body.querySelector("tr.invoice-line-remark")) return;
    var text = PREVIEW_COPY[spec.lang] || PREVIEW_COPY.en;
    body.appendChild(remarkRow(text.remarkTitle, text.remarkBody));
  }
  function addPreviewMerchantPrivacy() {
    var box = document.getElementById("privacy-policy-container");
    if (!box) {
      var footer = document.querySelector(".footerIfIframe") || document.querySelector(".footer");
      if (!footer || !footer.parentNode) return;
      box = document.createElement("div");
      box.id = "privacy-policy-container";
      box.setAttribute("data-preview-only", "true");
      footer.parentNode.insertBefore(box, footer);
    }
    if (box.querySelector("a")) return;
    var a = document.createElement("a");
    a.href = "https://www.example.com/privacy";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = (PREVIEW_COPY[spec.lang] || PREVIEW_COPY.en).privacy;
    box.appendChild(a);
  }

  new MutationObserver(function () {
    addInvoiceLineRemark();
    addPreviewMerchantPrivacy();
  }).observe(root, {
    childList: true,
    subtree: true
  });

  var base = document.createElement("base");
  base.href = spec.base;
  document.head.prepend(base);

  var bust = String(Date.now());
  spec.css.forEach(function (href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href + (href.indexOf("?") >= 0 ? "&" : "?") + "t=" + bust;
    document.head.appendChild(link);
  });

  fetch(spec.html + "?t=" + bust)
    .then(function (res) {
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      return res.text();
    })
    .then(function (html) {
      var origFetch = window.fetch.bind(window);
      window.fetch = function (url, opts) {
        var href = String(url);
        if (href.indexOf("checkout.html") !== -1 || href.indexOf("iframe.html") !== -1) {
          return Promise.resolve(
            new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
          );
        }
        return origFetch(url, opts);
      };
      var script = document.createElement("script");
      script.src = spec.mock + (spec.mock.indexOf("?") >= 0 ? "&" : "?") + "t=" + bust;
      script.onerror = function () {
        root.textContent = "Could not load " + spec.mock;
      };
      document.body.appendChild(script);
      var wallets = document.createElement("script");
      wallets.src = "/cardcom-preview/preview-wallets.js?t=" + bust;
      document.body.appendChild(wallets);
    })
    .catch(function (err) {
      root.textContent =
        "Could not load " + spec.html + ". Serve the repo root (port 3000 or 8080). " + err;
    });
})();
