(function () {
  var I = window.__I18N;
  var S = window.__SITE;
  var texts = document.querySelectorAll('[data-t]');
  var holders = document.querySelectorAll('[data-p]');
  var buttons = document.querySelectorAll('.lang button');

  function setLang(l) {
    var d = I[l];
    if (!d) return;
    texts.forEach(function (e) {
      var v = d[e.dataset.t];
      if (v != null) e.innerHTML = v;
    });
    holders.forEach(function (e) {
      var v = d[e.dataset.p];
      if (v != null) e.placeholder = v;
    });
    document.documentElement.lang = l;
    buttons.forEach(function (b) {
      b.classList.toggle('on', b.dataset.l === l);
    });
    try {
      localStorage.setItem('fw-lang', l);
    } catch (x) {}
  }

  buttons.forEach(function (b) {
    b.onclick = function () {
      setLang(b.dataset.l);
    };
  });

  try {
    var saved = localStorage.getItem('fw-lang');
    if (saved && saved !== 'en') setLang(saved);
  } catch (x) {}

  document.getElementById('f').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(e.target);
    var m =
      'Hi, I need fabrication work in Nagpur.\nName: ' + d.get('name') +
      '\nPhone: ' + d.get('phone') +
      '\nNeed: ' + d.get('need') +
      '\nArea: ' + d.get('area');
    window.open(S.waBase + '?text=' + encodeURIComponent(m), '_blank');
  });
})();
