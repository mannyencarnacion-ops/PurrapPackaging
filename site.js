/* Purrap Packaging — interactions. Vanilla JS. */
(function () {
  'use strict';
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  // mobile menu
  var mt = document.querySelector('.menu-toggle');
  if (mt) mt.addEventListener('click', function () {
    var n = document.getElementById('nav'); if (!n) return;
    var open = n.classList.toggle('open'); this.setAttribute('aria-expanded', open);
  });

  // reveal
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); }
  else {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  // product prefill on contact
  var params = new URLSearchParams(location.search);
  var product = params.get('product'); var sel = document.getElementById('product');
  if (product && sel) { for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value.toLowerCase() === product.toLowerCase()) { sel.selectedIndex = i; break; } } }

  // add order details toggle
  var tog = document.querySelector('.toggle');
  if (tog) tog.addEventListener('click', function () {
    var m = document.getElementById('more'); if (!m) return;
    var open = m.classList.toggle('open');
    var lbl = this.querySelector('span'); if (lbl) lbl.textContent = open ? 'Hide order details' : 'Add order details (optional, helps us quote faster)';
  });

  // form validation
  var form = document.querySelector('form.lead-form');
  if (form) {
    function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim()); }
    function mark(input, bad) { var f = input.closest('label') || input.parentNode; if (f) f.classList.toggle('field-bad', bad); input.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
    form.addEventListener('submit', function (e) {
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (input) {
        var bad = !input.value.trim(); if (!bad && input.type === 'email') bad = !isEmail(input.value);
        mark(input, bad); if (bad && ok) input.focus(); if (bad) ok = false;
      });
      if (!ok) e.preventDefault();
    });
    form.querySelectorAll('[required]').forEach(function (input) {
      input.addEventListener('blur', function () { var bad = !input.value.trim(); if (!bad && input.type === 'email') bad = !isEmail(input.value); mark(input, bad); });
    });
  }

  // exit-intent modal
  var modal = document.getElementById('exit');
  if (modal) {
    var shown = false;
    function open() { if (shown) return; modal.classList.add('open'); shown = true; }
    document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && e.clientY <= 0) open(); });
    setTimeout(open, 28000);
    window.closeExit = function () { modal.classList.remove('open'); };
    modal.addEventListener('click', function (e) { if (e.target === this) window.closeExit(); });
  }
})();
