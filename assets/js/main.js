/* ==========================================================================
   IndexJet — Marketing site interactions
   Mobile nav · tabs · FAQ accordion · counters · reveal · toasts · widget
   ========================================================================== */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.getElementById("main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      mainNav.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mainNav.classList.contains("is-open")) {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window && !prefersReducedMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Animated counters ---------- */
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    if (prefersReducedMotion) {
      el.textContent = prefix + target.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
      return;
    }
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = prefix + val.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* ---------- Tabs (submission widget) ---------- */
  document.querySelectorAll("[role='tablist']").forEach(function (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll("[role='tab']"));
    function activate(tab) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
      tab.focus();
    }
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { activate(tab); });
      tab.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(tab);
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); activate(next); }
      });
    });
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var answer = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", String(!expanded));
      if (answer) answer.classList.toggle("is-open", !expanded);
    });
  });

  /* ---------- Toasts ---------- */
  var toastRegion = document.querySelector(".toast-region");
  if (!toastRegion) {
    toastRegion = document.createElement("div");
    toastRegion.className = "toast-region";
    toastRegion.setAttribute("role", "status");
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }
  var toastIcons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5m0-3h.01"/></svg>'
  };
  window.ijToast = function (message, type) {
    type = type || "info";
    var toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.innerHTML = (toastIcons[type] || toastIcons.info) + "<span></span>";
    toast.querySelector("span").textContent = message;
    toastRegion.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("leaving");
      setTimeout(function () { toast.remove(); }, 320);
    }, 4200);
  };

  /* ---------- URL validation helpers ---------- */
  function isValidUrl(value) {
    try {
      var u = new URL(value.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) { return false; }
  }
  window.ijIsValidUrl = isValidUrl;

  /* ---------- Submission widget (demo) ---------- */
  function bindSubmitForm(formId, getUrls) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errEl = form.querySelector(".field-error");
      var input = form.querySelector(".input");
      var result = getUrls(form);
      if (result.error) {
        if (errEl) { errEl.textContent = result.error; errEl.hidden = false; }
        if (input) input.setAttribute("aria-invalid", "true");
        window.ijToast(result.error, "error");
        return;
      }
      if (errEl) errEl.hidden = true;
      if (input) input.removeAttribute("aria-invalid");
      var btn = form.querySelector("button[type='submit']");
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Submitting…";
      setTimeout(function () {
        btn.disabled = false;
        btn.textContent = original;
        var box = form.querySelector(".widget-result");
        if (box) {
          box.hidden = false;
          box.querySelector("span").textContent =
            result.count + (result.count === 1 ? " URL" : " URLs") +
            " accepted — queued for indexing. Create a free account to track live status.";
        }
        window.ijToast(result.count + " URL" + (result.count === 1 ? "" : "s") + " submitted to the indexing queue", "success");
        form.reset();
      }, 900);
    });
  }

  bindSubmitForm("single-url-form", function (form) {
    var value = (form.querySelector("input[type='url']") || {}).value || "";
    if (!isValidUrl(value)) return { error: "Please enter a valid URL, including https://" };
    return { count: 1 };
  });

  bindSubmitForm("bulk-url-form", function (form) {
    var raw = (form.querySelector("textarea") || {}).value || "";
    var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { error: "Paste at least one URL (one per line)." };
    var invalid = lines.filter(function (l) { return !isValidUrl(l); });
    if (invalid.length) return { error: invalid.length + " line(s) are not valid URLs. Each line must start with https://" };
    var unique = lines.filter(function (l, i) { return lines.indexOf(l) === i; });
    return { count: unique.length };
  });

  /* ---------- Drag & drop upload (demo) ---------- */
  var dropzone = document.querySelector(".dropzone");
  if (dropzone) {
    var fileInput = dropzone.querySelector("input[type='file']");
    function handleFiles(files) {
      if (!files || !files.length) return;
      var f = files[0];
      if (!/\.(txt|csv)$/i.test(f.name)) {
        window.ijToast("Only .txt and .csv files are supported", "error");
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var lines = String(reader.result).split(/\r?\n/).filter(function (l) { return isValidUrl(l.trim().split(",")[0]); });
        var box = dropzone.closest("[role='tabpanel'], form, div").querySelector(".widget-result");
        if (box) {
          box.hidden = false;
          box.querySelector("span").textContent =
            lines.length + " valid URL" + (lines.length === 1 ? "" : "s") + " detected in " + f.name + " — queued for indexing.";
        }
        window.ijToast(lines.length + " URLs parsed from " + f.name, "success");
      };
      reader.readAsText(f);
    }
    ["dragenter", "dragover"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("is-drag"); });
    });
    dropzone.addEventListener("drop", function (e) { handleFiles(e.dataTransfer.files); });
    dropzone.addEventListener("click", function () { if (fileInput) fileInput.click(); });
    dropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (fileInput) fileInput.click(); }
    });
    if (fileInput) fileInput.addEventListener("change", function () { handleFiles(fileInput.files); });
  }

  /* ---------- Copy-to-clipboard buttons ---------- */
  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = btn.parentElement.querySelector("pre");
      if (!pre) return;
      navigator.clipboard.writeText(pre.textContent).then(function () {
        window.ijToast("Copied to clipboard", "success");
      }, function () {
        window.ijToast("Copy failed — select the text manually", "error");
      });
    });
  });

  /* ---------- Billing period toggle (pricing) ---------- */
  var billingSwitch = document.querySelector(".switch[data-billing]");
  if (billingSwitch) {
    billingSwitch.addEventListener("click", function () {
      var yearly = billingSwitch.getAttribute("aria-checked") !== "true";
      billingSwitch.setAttribute("aria-checked", String(yearly));
      document.querySelectorAll("[data-monthly]").forEach(function (el) {
        var v = yearly ? el.getAttribute("data-yearly") : el.getAttribute("data-monthly");
        el.firstChild.textContent = v;
      });
    });
  }

  /* ---------- Live hero ticker (demo animation) ---------- */
  var heroRows = document.getElementById("hero-rows");
  if (heroRows && !prefersReducedMotion) {
    var demoUrls = [
      "example.com/new-product-launch",
      "myblog.io/technical-seo-guide",
      "store.co/collections/summer-sale",
      "news-site.com/breaking-story-2026",
      "saasapp.dev/changelog/v3-2",
      "agency.digital/case-studies/client-x",
      "shop.example/category/best-sellers",
      "docs.startup.app/getting-started"
    ];
    var pillIndexed = '<span class="status-pill indexed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Indexed</span>';
    var pillProcessing = '<span class="status-pill processing"><svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>Processing</span>';
    var pillQueued = '<span class="status-pill queued">Queued</span>';
    var tick = 0;
    setInterval(function () {
      tick++;
      var rows = heroRows.querySelectorAll(".index-row");
      // Promote statuses: queued -> processing -> indexed
      rows.forEach(function (row) {
        var pill = row.querySelector(".status-pill");
        if (pill.classList.contains("processing")) row.querySelector(".pill-slot").innerHTML = pillIndexed;
        else if (pill.classList.contains("queued")) row.querySelector(".pill-slot").innerHTML = pillProcessing;
      });
      // Add a fresh row on top
      var url = demoUrls[tick % demoUrls.length];
      var row = document.createElement("div");
      row.className = "index-row";
      row.innerHTML = '<span class="url"></span><span class="pill-slot">' + pillQueued + "</span>";
      row.querySelector(".url").textContent = "https://" + url;
      heroRows.prepend(row);
      while (heroRows.children.length > 4) heroRows.lastElementChild.remove();
    }, 2600);
  }

  /* ---------- Simple client-side form validation (contact/auth demos) ---------- */
  document.querySelectorAll("form[data-demo-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll("[required]").forEach(function (field) {
        var err = field.closest(".field") && field.closest(".field").querySelector(".field-error");
        var bad = !field.value.trim() || (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value));
        field.toggleAttribute("aria-invalid", bad);
        if (err) err.hidden = !bad;
        if (bad) valid = false;
      });
      if (!valid) { window.ijToast("Please fix the highlighted fields", "error"); return; }
      var msg = form.getAttribute("data-success") || "Done! We'll be in touch shortly.";
      window.ijToast(msg, "success");
      form.reset();
    });
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
