/* ==========================================================================
   IndexJet — Dashboard interactions
   Theme toggle · panel navigation · demo data · live ticker
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Dark mode (persisted, respects system preference) ---------- */
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem("ij-theme"); } catch (e) { /* private mode */ }
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.setAttribute("data-theme", stored || (systemDark ? "dark" : "light"));

  var themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ij-theme", next); } catch (e) { /* ignore */ }
      themeToggle.setAttribute("aria-pressed", String(next === "dark"));
    });
  }

  /* ---------- Sidebar (mobile) ---------- */
  var sidebar = document.querySelector(".db-sidebar");
  var overlay = document.querySelector(".db-overlay");
  var menuBtn = document.querySelector(".db-menu-btn");
  function closeSidebar() {
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  if (menuBtn && sidebar && overlay) {
    menuBtn.addEventListener("click", function () {
      var open = sidebar.classList.toggle("is-open");
      overlay.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSidebar();
    });
  }

  /* ---------- Panel navigation ---------- */
  var navButtons = document.querySelectorAll(".db-nav button[data-panel]");
  var panels = document.querySelectorAll(".db-panel");
  var titleEl = document.getElementById("db-title");
  function showPanel(name) {
    panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    navButtons.forEach(function (b) {
      if (b.getAttribute("data-panel") === name) {
        b.setAttribute("aria-current", "page");
        if (titleEl) titleEl.textContent = b.textContent.replace(/\d+$/, "").trim();
      } else {
        b.removeAttribute("aria-current");
      }
    });
    if (window.innerWidth <= 980 && sidebar) closeSidebar();
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }
  navButtons.forEach(function (btn) {
    btn.addEventListener("click", function () { showPanel(btn.getAttribute("data-panel")); });
  });
  var initial = (location.hash || "#overview").slice(1);
  if (!document.querySelector('.db-nav button[data-panel="' + initial + '"]')) initial = "overview";
  showPanel(initial);

  /* ---------- Toast helper (shared with main.js pattern) ---------- */
  var toastRegion = document.querySelector(".toast-region");
  function toast(message, type) {
    if (window.ijToast) return window.ijToast(message, type);
    if (!toastRegion) return;
    var t = document.createElement("div");
    t.className = "toast " + (type || "info");
    t.textContent = message;
    toastRegion.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  /* ---------- Demo submission table ticker ---------- */
  var tbody = document.getElementById("recent-submissions");
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tbody && !prefersReducedMotion) {
    var demoUrls = [
      "https://example.com/blog/launch-week-recap",
      "https://store.example/products/aurora-lamp",
      "https://docs.example/guides/webhooks",
      "https://news.example/2026/07/market-report",
      "https://example.io/case-studies/ranklab"
    ];
    var statuses = [
      '<span class="status-pill indexed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Indexed</span>',
      '<span class="status-pill processing"><svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>Processing</span>',
      '<span class="status-pill queued">Queued</span>'
    ];
    var n = 0;
    setInterval(function () {
      n++;
      // promote existing rows
      tbody.querySelectorAll(".status-pill.queued").forEach(function (p) {
        p.outerHTML = statuses[1];
      });
      tbody.querySelectorAll(".status-pill.processing").forEach(function (p, i) {
        if (i === 0) p.outerHTML = statuses[0];
      });
      var tr = document.createElement("tr");
      var url = demoUrls[n % demoUrls.length];
      var now = new Date();
      tr.innerHTML =
        '<td class="url-cell"></td>' +
        "<td>" + statuses[2] + "</td>" +
        "<td>Google, Bing, IndexNow</td>" +
        "<td>" + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "</td>";
      tr.querySelector(".url-cell").textContent = url;
      tbody.prepend(tr);
      while (tbody.children.length > 6) tbody.lastElementChild.remove();
    }, 3400);
  }

  /* ---------- Demo actions ---------- */
  document.querySelectorAll("[data-toast]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      toast(el.getAttribute("data-toast"), el.getAttribute("data-toast-type") || "success");
    });
  });

  /* ---------- API key visibility + copy ---------- */
  document.querySelectorAll("[data-reveal-key]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = document.getElementById(btn.getAttribute("data-reveal-key"));
      if (!code) return;
      var hidden = code.getAttribute("data-hidden") !== "false";
      code.textContent = hidden ? code.getAttribute("data-key") : "ij_live_••••••••••••••••••••";
      code.setAttribute("data-hidden", String(!hidden));
      btn.textContent = hidden ? "Hide" : "Reveal";
    });
  });
  document.querySelectorAll("[data-copy-key]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = document.getElementById(btn.getAttribute("data-copy-key"));
      if (!code) return;
      navigator.clipboard.writeText(code.getAttribute("data-key")).then(function () {
        toast("API key copied to clipboard", "success");
      });
    });
  });

  /* ---------- Dashboard submit forms (demo) ---------- */
  var dbSingle = document.getElementById("db-single-form");
  if (dbSingle) {
    dbSingle.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = dbSingle.querySelector("input[type='url']");
      var valid;
      try { var u = new URL(input.value.trim()); valid = u.protocol === "http:" || u.protocol === "https:"; }
      catch (err) { valid = false; }
      if (!valid) {
        input.setAttribute("aria-invalid", "true");
        toast("Please enter a valid URL including https://", "error");
        return;
      }
      input.removeAttribute("aria-invalid");
      toast("URL queued for indexing across Google, Bing & IndexNow", "success");
      dbSingle.reset();
    });
  }
  var dbBulk = document.getElementById("db-bulk-form");
  if (dbBulk) {
    dbBulk.addEventListener("submit", function (e) {
      e.preventDefault();
      var lines = dbBulk.querySelector("textarea").value.split(/\r?\n/).filter(function (l) { return l.trim(); });
      if (!lines.length) { toast("Paste at least one URL", "error"); return; }
      toast(lines.length + " URLs validated and queued — track them in Reports", "success");
      dbBulk.reset();
    });
  }
})();
