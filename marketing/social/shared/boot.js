/* ============================================================================
   five* social — BOOT
   Runs on every post. Two jobs: pick the export format, and expand shorthand
   markup into the fiddly bits so post files stay readable.
   ============================================================================ */

(function () {
  /* --- Export format -------------------------------------------------------
     ?f=square | portrait | story. Defaults to square. render.mjs drives this. */
  var f = new URLSearchParams(location.search).get("f") || "square";
  if (["square", "portrait", "story"].indexOf(f) === -1) f = "square";
  document.documentElement.setAttribute("data-f", f);

  /* --- Star motif ----------------------------------------------------------
     <div class="stars" data-rating="2"></div> → 5 stars, 2 lit.
     Beats hand-maintaining five near-identical SVG paths per post. */
  var STAR = "M12 2l2.9 6.26L21.8 9.2l-5 4.6 1.3 6.9L12 17.3 5.9 20.7l1.3-6.9-5-4.6 6.9-.94z";

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".stars[data-rating]").forEach(function (row) {
      var lit = parseInt(row.getAttribute("data-rating"), 10) || 0;
      var out = "";
      for (var i = 0; i < 5; i++) {
        out +=
          '<svg viewBox="0 0 24 24"><path class="' +
          (i < lit ? "lit" : "dim") +
          '" d="' + STAR + '"/></svg>';
      }
      row.innerHTML = out;
    });
  });

  /* --- Fit check -----------------------------------------------------------
     ?check=1 makes the page measure itself and write the verdict into
     <title>, where check.mjs picks it up via Chrome's --dump-dom. The frame is
     overflow:hidden, so a post that doesn't fit loses its footer silently —
     this is the only thing standing between that and a published PNG. */
  if (new URLSearchParams(location.search).get("check") !== "1") return;

  window.addEventListener("load", function () {
    document.fonts.ready.then(function () {
      var frame = document.querySelector(".frame");
      var fh = frame.getBoundingClientRect().height;
      var problems = [];

      // 1. Does the footer still sit inside the canvas?
      var foot = document.querySelector(".foot").getBoundingClientRect();
      if (foot.bottom > fh + 0.5)
        problems.push("footer pushed " + Math.round(foot.bottom - fh) + "px off canvas");

      // 2. Does anything spill past the 888px content column?
      //    Measured with a Range: a block-level span always reports container
      //    width, which is what made an earlier version of this check useless.
      var limit = 888 + 0.5;
      document.querySelectorAll(".body *").forEach(function (el) {
        if (!el.firstChild) return;
        var r = document.createRange();
        r.selectNodeContents(el);
        var w = r.getBoundingClientRect().width;
        if (w > limit)
          problems.push((el.className || el.tagName) + " is " + w.toFixed(0) + "px wide");
      });

      // 3. Headlines are hand-broken and must stay at exactly one line each.
      document.querySelectorAll(".headline .l1, .headline .l2").forEach(function (el) {
        var r = document.createRange();
        r.selectNodeContents(el);
        var tops = {}, n = 0;
        Array.prototype.forEach.call(r.getClientRects(), function (rect) {
          var k = Math.round(rect.top);
          if (!tops[k]) { tops[k] = 1; n++; }
        });
        if (n > 1) problems.push(el.className + " wrapped to " + n + " lines");
      });

      document.title = "FITCHECK:" + (problems.length ? problems.join(" | ") : "PASS");
    });
  });
})();
