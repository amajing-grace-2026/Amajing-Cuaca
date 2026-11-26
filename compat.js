/* Amajing Cuaca — Pemeriksa kompatibilitas (gratis, berjalan di HP pengguna).
   Sengaja ditulis dengan JavaScript lama (ES5) supaya tetap jalan di browser/HP tua
   dan bisa memberi tahu apa yang tidak berfungsi. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var MIN = { Chrome: 90, 'Samsung Internet': 14, Edge: 90, Opera: 76, Firefox: 90, Safari: 14 };

  function num(re) { var m = ua.match(re); return m ? parseFloat(m[1].replace('_', '.')) : null; }

  function detect() {
    var d = { os: 'Tidak diketahui', osVer: null, browser: 'Tidak diketahui', browserVer: null, mobile: /Mobi|Android|iPhone|iPad/.test(ua), inApp: false, inAppName: '' };
    var isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) {
      d.os = isIPadOS || /iPad/.test(ua) ? 'iPadOS' : 'iOS';
      d.osVer = num(/OS (\d+[_.]\d+)/) || num(/Version\/(\d+(\.\d+)?)/);
      d.mobile = true;
    } else if (/Android/.test(ua)) { d.os = 'Android'; d.osVer = num(/Android (\d+(\.\d+)?)/); }
    else if (/CrOS/.test(ua)) d.os = 'ChromeOS';
    else if (/Windows/.test(ua)) d.os = 'Windows';
    else if (/Mac OS X/.test(ua)) d.os = 'macOS';
    else if (/Linux/.test(ua)) d.os = 'Linux';

    var b = [
      ['Samsung Internet', /SamsungBrowser\/(\d+(\.\d+)?)/],
      ['Edge', /Edg(?:A|iOS)?\/(\d+(\.\d+)?)/],
      ['Opera', /(?:OPR|OPT)\/(\d+(\.\d+)?)/],
      ['Firefox', /(?:Firefox|FxiOS)\/(\d+(\.\d+)?)/],
      ['Chrome', /CriOS\/(\d+(\.\d+)?)/],
      ['Chrome', /Chrome\/(\d+(\.\d+)?)/],
      ['Safari', /Version\/(\d+(\.\d+)?).*Safari/]
    ];
    for (var i = 0; i < b.length; i++) { var v = num(b[i][1]); if (v !== null) { d.browser = b[i][0]; d.browserVer = v; break; } }

    var apps = [['Facebook', /FBAN|FBAV|FB_IAB/], ['Instagram', /Instagram/], ['TikTok', /TikTok|musical_ly|BytedanceWebview/], ['LINE', /\bLine\//], ['Twitter/X', /Twitter/], ['Snapchat', /Snapchat/]];
    for (var j = 0; j < apps.length; j++) if (apps[j][1].test(ua)) { d.inApp = true; d.inAppName = apps[j][0]; }
    if (!d.inApp && /Android/.test(ua) && /; wv\)/.test(ua)) { d.inApp = true; d.inAppName = 'aplikasi lain (WebView)'; }
    if (!d.inApp && d.os.indexOf('OS') > 0 && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) { d.inApp = true; d.inAppName = 'aplikasi lain (WebView)'; }
    return d;
  }

  function cssOK(p, v) { try { return !!(window.CSS && CSS.supports && CSS.supports(p, v)); } catch (e) { return false; } }
  function storageOK() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }

  function updateHint(d) {
    if (d.os === 'iOS' || d.os === 'iPadOS') return 'Perbarui iOS: Pengaturan → Umum → Pembaruan Perangkat Lunak.';
    if (d.browser === 'Samsung Internet') return 'Perbarui Samsung Internet lewat Galaxy Store / Play Store.';
    if (d.os === 'Android') return 'Perbarui ' + (d.browser === 'Tidak diketahui' ? 'Google Chrome' : d.browser) + ' lewat Play Store, atau pasang Google Chrome.';
    return 'Perbarui browser ke versi terbaru (menu browser → Bantuan/Tentang), atau gunakan Google Chrome / Microsoft Edge.';
  }

  // status: ok | warn | fail | info
  function runChecks(d, done) {
    var secure = window.isSecureContext !== false && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
    var R = [];
    function add(o) { R.push(o); }

    add({ name: 'Mesin JavaScript modern', status: 'noModule' in document.createElement('script') ? 'ok' : 'fail', critical: true,
      affects: 'Seluruh tampilan cuaca tidak bisa berjalan.', fix: updateHint(d) });
    add({ name: 'Ambil data dari internet', status: (window.fetch && window.Promise) ? 'ok' : 'fail', critical: true,
      affects: 'Data cuaca tidak bisa diambil.', fix: updateHint(d) });
    add({ name: 'Koneksi aman (HTTPS)', status: secure ? 'ok' : 'fail',
      affects: 'GPS dan mode offline diblokir oleh browser.', fix: 'Buka aplikasi lewat alamat https:// resminya.' });
    add({ name: 'Lokasi GPS', status: ('geolocation' in navigator) && secure ? 'ok' : 'fail',
      affects: 'Lokasi otomatis tidak terdeteksi — kamu tetap bisa mencari lokasi secara manual.', fix: d.inApp ? 'Buka di Chrome/Safari.' : updateHint(d) });
    add({ id: 'perm', name: 'Izin lokasi untuk situs ini', status: 'info', note: 'Belum diperiksa' });
    add({ name: 'Penyimpanan lokal', status: storageOK() ? 'ok' : 'warn',
      affects: 'Lokasi favorit, riwayat, dan data offline tidak tersimpan.', fix: 'Jangan pakai mode penyamaran/incognito, dan izinkan cookie & data situs.' });
    add({ name: 'Mode offline', status: ('serviceWorker' in navigator) && secure ? 'ok' : 'warn',
      affects: 'Aplikasi tidak bisa dibuka tanpa internet dan mungkin tidak bisa dipasang.', fix: d.inApp ? 'Buka di Chrome/Safari.' : updateHint(d) });

    // Pasang ke layar utama
    var inst = { name: 'Pasang ke layar utama / desktop', status: 'ok', note: '' };
    if (standalone()) inst.note = 'Sudah terpasang sebagai aplikasi ✓';
    else if (d.inApp) { inst.status = 'fail'; inst.affects = 'Tidak bisa dipasang dari dalam ' + d.inAppName + '.'; inst.fix = 'Ketuk menu ⋮ / ••• → "Buka di browser" (Chrome atau Safari), lalu pasang dari sana.'; }
    else if (d.os === 'iOS' || d.os === 'iPadOS') {
      if (d.browser !== 'Safari' && (d.osVer || 0) < 16.4) { inst.status = 'warn'; inst.affects = 'Di iOS di bawah 16.4 hanya Safari yang bisa memasang aplikasi web.'; inst.fix = 'Buka di Safari → Bagikan → Tambah ke Layar Utama, atau perbarui iOS.'; }
      else inst.note = 'Lewat tombol Bagikan → "Tambah ke Layar Utama".';
    } else if (d.browser === 'Firefox' && !d.mobile) { inst.status = 'warn'; inst.affects = 'Firefox di laptop/PC tidak bisa memasang aplikasi web.'; inst.fix = 'Gunakan Google Chrome atau Microsoft Edge untuk memasang.'; }
    else if (d.browser === 'Safari' && d.os === 'macOS' && (d.browserVer || 0) < 17) { inst.status = 'warn'; inst.affects = 'Safari di bawah versi 17 tidak bisa memasang aplikasi web.'; inst.fix = 'Perbarui macOS/Safari, atau gunakan Chrome/Edge.'; }
    else inst.note = 'Didukung oleh browser ini.';
    add(inst);

    add({ name: 'Tampilan modern (grid & warna)', status: cssOK('display', 'grid') && cssOK('--a', '0') ? 'ok' : 'warn',
      affects: 'Tata letak bisa berantakan atau warnanya hilang.', fix: updateHint(d) });
    var intlOK = false; try { intlOK = !!(window.Intl && Intl.NumberFormat.supportedLocalesOf('id').length); } catch (e) { }
    add({ name: 'Format angka bahasa Indonesia', status: intlOK ? 'ok' : 'warn', cosmetic: true,
      affects: 'Angka mungkin tampil dengan format Inggris (titik, bukan koma).', fix: updateHint(d) });
    add({ name: 'Efek tampilan halus', status: cssOK('backdrop-filter', 'blur(2px)') || cssOK('-webkit-backdrop-filter', 'blur(2px)') ? 'ok' : 'warn', cosmetic: true,
      affects: 'Hanya kosmetik — tidak memengaruhi data cuaca.', fix: '' });
    add({ id: 'net', name: 'Koneksi ke server cuaca', status: 'info', note: 'Belum diperiksa' });

    // Saran versi
    var rec = [];
    if (d.inApp) rec.push('Kamu membuka aplikasi ini dari dalam ' + d.inAppName + '. Buka di Chrome (Android) atau Safari (iPhone) agar GPS dan pemasangan aplikasi berfungsi.');
    if (d.browserVer && MIN[d.browser] && d.browserVer < MIN[d.browser]) rec.push(d.browser + ' kamu versi ' + Math.floor(d.browserVer) + ', disarankan minimal versi ' + MIN[d.browser] + '. ' + updateHint(d));
    if (d.os === 'Android' && d.osVer && d.osVer < 8) rec.push('Android ' + d.osVer + ' sudah tidak mendapat pembaruan Chrome terbaru. Cek Setelan → Pembaruan perangkat lunak; bila tidak ada pembaruan, coba pasang Firefox dari Play Store.');
    if ((d.os === 'iOS' || d.os === 'iPadOS') && d.osVer && d.osVer < 15) rec.push(d.os + ' ' + d.osVer + ' terlalu lama. Perbarui ke iOS 15 atau lebih baru (Pengaturan → Umum → Pembaruan Perangkat Lunak).');

    var result = { device: d, checks: R, rec: rec };
    var pending = 2;
    function fin() { if (--pending === 0) done(result); }

    // Izin lokasi (tanpa memunculkan pertanyaan izin)
    var perm = R[4];
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (s) {
        if (s.state === 'granted') { perm.status = 'ok'; perm.note = 'Sudah diizinkan'; }
        else if (s.state === 'denied') { perm.status = 'warn'; perm.affects = 'Kamu pernah menolak izin lokasi, jadi GPS tidak bisa dipakai.'; perm.fix = 'Ketuk ikon gembok/ⓘ di samping alamat situs → Izin → Lokasi → Izinkan. Lalu muat ulang.'; }
        else { perm.status = 'info'; perm.note = 'Akan ditanyakan saat kamu menekan "Gunakan lokasi saya".'; }
        fin();
      }, function () { perm.note = 'Tidak bisa dicek di browser ini'; fin(); });
    } else { perm.note = 'Tidak bisa dicek di browser ini (tidak masalah)'; fin(); }

    // Uji koneksi ke server cuaca
    var net = R[R.length - 1];
    if (!window.fetch) { net.status = 'fail'; net.affects = 'Browser tidak bisa mengambil data.'; net.fix = updateHint(d); fin(); return; }
    var timer, finished = false;
    var t0 = Date.now();
    timer = setTimeout(function () { if (finished) return; finished = true; net.status = 'fail'; net.affects = 'Server cuaca tidak merespons dalam 10 detik.'; net.fix = 'Periksa koneksi internet. Jaringan kantor/sekolah kadang memblokir situs cuaca — coba pakai data seluler.'; fin(); }, 10000);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-7.98&longitude=112.63&current=temperature_2m', { cache: 'no-store' }).then(function (r) {
      if (finished) return; finished = true; clearTimeout(timer);
      if (r.ok) { net.status = 'ok'; net.note = 'Terhubung (' + (Date.now() - t0) + ' ms)'; }
      else { net.status = 'fail'; net.affects = 'Server membalas kode ' + r.status + '.'; net.fix = 'Coba lagi beberapa menit lagi.'; }
      fin();
    }, function () {
      if (finished) return; finished = true; clearTimeout(timer);
      net.status = 'fail'; net.affects = navigator.onLine === false ? 'Kamu sedang offline.' : 'Tidak bisa terhubung ke server cuaca.';
      net.fix = 'Nyalakan data seluler / Wi-Fi. Jika masih gagal, jaringanmu mungkin memblokir open-meteo.com.'; fin();
    });
  }

  function verdict(res) {
    var crit = false, part = false;
    for (var i = 0; i < res.checks.length; i++) {
      var c = res.checks[i];
      if (c.status === 'fail' && c.critical) crit = true;
      else if ((c.status === 'fail' || c.status === 'warn') && !c.cosmetic) part = true;
    }
    if (crit) return { level: 'fail', title: '❌ Tidak kompatibel', text: 'Aplikasi cuaca tidak bisa berjalan di browser/HP ini. Lihat saran perbaikan di bawah.' };
    if (part || res.rec.length) return { level: 'warn', title: '⚠️ Kompatibel sebagian', text: 'Data cuaca bisa tampil, tapi beberapa fitur mungkin tidak berfungsi dengan baik.' };
    return { level: 'ok', title: '✅ Kompatibel', text: 'Semua fitur utama berfungsi di perangkat ini.' };
  }

  function h(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ICON = { ok: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' };
  var COLOR = { ok: '#81c995', warn: '#fdd663', fail: '#f28b82', info: '#8ab4f8' };

  function deviceRows(d) {
    var rows = [
      ['Perangkat', d.model || (d.mobile ? 'HP / tablet' : 'Laptop / PC')],
      ['Sistem', d.os + (d.osVer ? ' ' + d.osVer : '')],
      ['Browser', d.browser + (d.browserVer ? ' ' + Math.floor(d.browserVer) : '')],
      ['Layar', screen.width + ' × ' + screen.height + (window.devicePixelRatio ? ' (×' + Math.round(window.devicePixelRatio * 10) / 10 + ')' : '')],
      ['Mode', standalone() ? 'Aplikasi terpasang' : 'Dibuka di browser']
    ];
    if (navigator.deviceMemory) rows.push(['Memori', '±' + navigator.deviceMemory + ' GB']);
    if (navigator.connection && navigator.connection.effectiveType) rows.push(['Jaringan', navigator.connection.effectiveType.toUpperCase()]);
    return rows;
  }

  function reportText(res, v) {
    var t = 'Hasil cek kompatibilitas Amajing Cuaca\n' + v.title.replace(/^[^ ]+ /, '') + '\n\n';
    var rows = deviceRows(res.device);
    for (var i = 0; i < rows.length; i++) t += rows[i][0] + ': ' + rows[i][1] + '\n';
    t += '\n';
    for (var j = 0; j < res.checks.length; j++) { var c = res.checks[j]; t += '[' + c.status.toUpperCase() + '] ' + c.name + (c.note ? ' — ' + c.note : '') + (c.affects && c.status !== 'ok' && c.status !== 'info' ? ' — ' + c.affects : '') + '\n'; }
    for (var k = 0; k < res.rec.length; k++) t += '\nSaran: ' + res.rec[k];
    return t + '\n\nUA: ' + ua;
  }

  var modal;
  function ensureStyle() {
    if (document.getElementById('compatStyle')) return;
    var st = document.createElement('style'); st.id = 'compatStyle';
    st.textContent =
      '.cmp-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:90;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.cmp{background:#2b2c30;color:#e8eaed;max-width:560px;margin:24px auto;border-radius:20px;padding:18px;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}' +
      '.cmp h3{margin:0 0 4px;font-size:19px}.cmp .vd{border-radius:14px;padding:12px 14px;margin:12px 0}' +
      '.cmp table{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0 10px}.cmp td{padding:5px 4px;border-bottom:1px solid #3c3d42;vertical-align:top}.cmp td:first-child{color:#9aa0a6;width:34%}' +
      '.cmp .it{border-bottom:1px solid #3c3d42;padding:9px 2px}.cmp .it b{font-weight:600}.cmp .it .s{font-size:13.5px;color:#bdc1c6;margin-top:2px}.cmp .it .fx{font-size:13.5px;color:#8ab4f8;margin-top:2px}' +
      '.cmp .rec{background:#41392a;color:#fde293;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:14px}' +
      '.cmp .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cmp button{font:inherit;border-radius:999px;padding:9px 16px;border:1px solid #5f6368;background:#35363b;color:#e8eaed;cursor:pointer}' +
      '.cmp button.p{background:#8ab4f8;color:#10223f;border-color:#8ab4f8;font-weight:700}.cmp .muted{color:#9aa0a6;font-size:13px}' +
      '.cmp-banner{background:#41392a;color:#fde293;padding:10px 14px;font:14px/1.4 system-ui,sans-serif;text-align:center}.cmp-banner.fail{background:#5c2b29;color:#f6aea9}.cmp-banner button{margin-left:8px;border:0;border-radius:999px;padding:5px 12px;background:#fde293;color:#202124;font-weight:700;cursor:pointer}';
    document.head.appendChild(st);
  }

  function render(res) {
    var v = verdict(res);
    var bg = { ok: '#1e3a2a', warn: '#41392a', fail: '#5c2b29' }[v.level];
    var html = '<h3>🔍 Cek kompatibilitas</h3><div class="muted">Gratis · diperiksa langsung di perangkatmu, tidak ada data yang dikirim ke kami.</div>' +
      '<div class="vd" style="background:' + bg + '"><b style="font-size:17px">' + v.title + '</b><div>' + h(v.text) + '</div></div>';
    for (var r = 0; r < res.rec.length; r++) html += '<div class="rec">💡 ' + h(res.rec[r]) + '</div>';
    html += '<b>Perangkatmu</b><table>';
    var rows = deviceRows(res.device);
    for (var i = 0; i < rows.length; i++) html += '<tr><td>' + h(rows[i][0]) + '</td><td>' + h(rows[i][1]) + '</td></tr>';
    html += '</table><b>Fitur</b>';
    for (var j = 0; j < res.checks.length; j++) {
      var c = res.checks[j];
      html += '<div class="it"><span>' + ICON[c.status] + '</span> <b style="color:' + COLOR[c.status] + '">' + h(c.name) + '</b>' +
        (c.status === 'ok' ? ' <span class="muted">' + h(c.note || 'Berfungsi') + '</span>' : '') +
        (c.status === 'info' ? '<div class="s">' + h(c.note) + '</div>' : '') +
        ((c.status === 'warn' || c.status === 'fail') ? '<div class="s">Tidak berfungsi baik: ' + h(c.affects) + '</div>' + (c.fix ? '<div class="fx">Solusi: ' + h(c.fix) + '</div>' : '') : '') +
        '</div>';
    }
    html += '<div class="btns"><button class="p" data-a="close">Tutup</button><button data-a="again">Cek ulang</button><button data-a="copy">Salin hasil</button>' +
      '<button data-a="send">Laporkan masalah</button></div>';
    modal.querySelector('.cmp').innerHTML = html;
    modal._text = reportText(res, v);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { alert('Hasil disalin. Tempel di formulir masukan bila perlu.'); }, function () { fallbackCopy(text); }); }
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('Hasil disalin.'); } catch (e) { alert(text); }
    document.body.removeChild(ta);
  }

  function withModel(d, cb) {
    // Chrome menyamarkan versi Android & model di user-agent; minta versi asli bila tersedia
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['platformVersion', 'model']).then(function (x) {
        if (x.model) d.model = x.model;
        if (d.os === 'Android' && x.platformVersion) { var pv = parseFloat(x.platformVersion); if (pv) d.osVer = pv; }
        if (d.os === 'Windows' && x.platformVersion) { d.osVer = parseInt(x.platformVersion, 10) >= 13 ? '11' : '10'; }
        cb(d);
      }, function () { cb(d); });
    } else cb(d);
  }

  function open() {
    ensureStyle();
    if (!modal) {
      modal = document.createElement('div'); modal.className = 'cmp-bg';
      modal.innerHTML = '<div class="cmp" role="dialog" aria-modal="true"></div>';
      modal.addEventListener('click', function (e) {
        var a = e.target.getAttribute && e.target.getAttribute('data-a');
        if (e.target === modal || a === 'close') modal.style.display = 'none';
        else if (a === 'again') open();
        else if (a === 'copy') copy(modal._text);
        else if (a === 'send') { copy(modal._text); window.open('https://forms.gle/fZAtNMCwKqhQhgpKA', '_blank'); }
      });
      document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    modal.querySelector('.cmp').innerHTML = '<h3>🔍 Memeriksa perangkatmu…</h3><p class="muted">Sebentar, sedang menguji fitur satu per satu.</p>';
    withModel(detect(), function (d) { runChecks(d, render); });
  }

  // Pemeriksaan senyap saat aplikasi dibuka: tampilkan pita peringatan bila ada masalah
  function silent() {
    withModel(detect(), function (d) {
      runChecks(d, function (res) {
        // jangan munculkan pita hanya karena izin lokasi/koneksi saat offline
        var v = verdict({ device: res.device, rec: res.rec, checks: res.checks.filter(function (c) { return c.name !== 'Koneksi ke server cuaca'; }) });
        if (v.level === 'ok') return;
        var key = 'cuaca.compatDismiss.' + v.level;
        try { if (v.level !== 'fail' && localStorage.getItem(key)) return; } catch (e) { }
        ensureStyle();
        var b = document.createElement('div'); b.className = 'cmp-banner' + (v.level === 'fail' ? ' fail' : '');
        b.innerHTML = h(v.title) + ' — ' + (v.level === 'fail' ? 'aplikasi tidak bisa berjalan di sini.' : 'ada fitur yang mungkin tidak berfungsi di perangkat ini.') +
          '<button type="button">Lihat detail</button>' + (v.level !== 'fail' ? ' <button type="button" style="background:transparent;color:inherit">✕</button>' : '');
        var btns = b.getElementsByTagName('button');
        btns[0].onclick = open;
        if (btns[1]) btns[1].onclick = function () { b.parentNode.removeChild(b); try { localStorage.setItem(key, '1'); } catch (e) { } };
        document.body.insertBefore(b, document.body.firstChild);
      });
    });
  }

  window.AmajingCompat = { open: open, detect: detect };

  function boot() {
    // Browser yang tidak mendukung modul JS tidak akan menjalankan app.js sama sekali
    if (!('noModule' in document.createElement('script'))) {
      var l = document.getElementById('loading');
      if (l) l.innerHTML = '❌ Browser ini terlalu lama untuk menjalankan Amajing Cuaca.<br><br><button onclick="AmajingCompat.open()" style="padding:10px 18px;border-radius:999px;border:0;background:#8ab4f8;font-weight:bold">Lihat detail &amp; solusi</button>';
      var c = document.getElementById('compatBtn'); if (c) c.onclick = open;
      open();
      return;
    }
    setTimeout(silent, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
