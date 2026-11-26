// Amajing Cuaca — PWA prakiraan cuaca (Amajing Labs)
// Data: Open-Meteo (cuaca + kualitas udara), BigDataCloud (nama lokasi dari GPS). Tanpa API key.

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* penyimpanan penuh / diblokir */ } },
};
const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const fmt1 = (n) => nf1.format(n);

const state = {
  places: LS.get('cuaca.places', []),   // {id,name,admin,country,lat,lon,fav,last}
  active: LS.get('cuaca.active', null), // {mode:'gps', id} | {mode:'place', id}
  place: null, wx: null, aq: null, fetchedAt: 0, day: 0,
};

/* ===================== Ikon cuaca (SVG) ===================== */
const CLOUD = 'M18 46h28a10 10 0 0 0 0-20a14 14 0 0 0-26.5-2a11 11 0 0 0-1.5 22z';
const sun = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="10" fill="#FDB813"/><g stroke="#FDB813" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-14" x2="0" y2="-18" transform="rotate(${a})"/>`).join('')}</g></g>`;
const moon = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M4-13a13 13 0 1 0 9 22A11 11 0 0 1 4-13z" fill="#E8E6F0"/></g>`;
const cloud = (fill, dy = 0) => `<path d="${CLOUD}" fill="${fill}" transform="translate(0 ${dy})"/>`;
const drops = (n, color = '#8ab4f8') => `<g stroke="${color}" stroke-width="3" stroke-linecap="round">${[22, 32, 42].slice(0, n).map((x) => `<line x1="${x}" y1="46" x2="${x - 3}" y2="55"/>`).join('')}</g>`;

function iconKind(code) {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostly';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 80].includes(code)) return 'rain';
  if ([63, 65, 66, 67, 81, 82].includes(code)) return 'heavy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}
function wxIcon(code, isDay = 1) {
  const k = iconKind(code);
  const orb = (x, y, s) => (isDay ? sun(x, y, s) : moon(x, y, s));
  let g = '';
  switch (k) {
    case 'clear': g = isDay ? sun(32, 32, 1.3) : moon(32, 32, 1.4); break;
    case 'mostly': g = orb(26, 24, 1) + `<g transform="translate(14 14) scale(.7)">${cloud('#E6EBF2')}</g>`; break;
    case 'partly': g = orb(22, 22, .9) + cloud('#E6EBF2', 0); break;
    case 'cloudy': g = `<g transform="translate(8 -6) scale(.8)">${cloud('#9AA6B8')}</g>` + cloud('#D5DCE6', 2); break;
    case 'fog': g = cloud('#B8C1CE', -6) + '<g stroke="#B8C1CE" stroke-width="3" stroke-linecap="round"><line x1="14" y1="48" x2="50" y2="48"/><line x1="18" y1="55" x2="46" y2="55"/></g>'; break;
    case 'drizzle': g = cloud('#C5CEDA', -8) + drops(2); break;
    case 'rain': g = cloud('#AAB5C5', -8) + drops(3); break;
    case 'heavy': g = cloud('#8693A6', -8) + drops(3, '#5b9cff') + '<g stroke="#5b9cff" stroke-width="3" stroke-linecap="round"><line x1="27" y1="50" x2="25" y2="56"/><line x1="37" y1="50" x2="35" y2="56"/></g>'; break;
    case 'snow': g = cloud('#C5CEDA', -8) + '<g fill="#fff">' + [20, 32, 44].map((x) => `<circle cx="${x}" cy="51" r="2.6"/>`).join('') + '</g>'; break;
    case 'storm': g = cloud('#7C879A', -8) + '<path d="M33 40l-8 11h6l-4 10 11-14h-6l4-7z" fill="#FDD663"/>' + '<g stroke="#8ab4f8" stroke-width="3" stroke-linecap="round"><line x1="20" y1="44" x2="17" y2="52"/><line x1="46" y1="44" x2="43" y2="52"/></g>'; break;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${g}</svg>`;
}
const WX_TEXT = {
  0: 'Cerah', 1: 'Cerah berawan', 2: 'Berawan sebagian', 3: 'Berawan tebal',
  45: 'Berkabut', 48: 'Kabut beku',
  51: 'Gerimis ringan', 53: 'Gerimis', 55: 'Gerimis lebat', 56: 'Gerimis beku', 57: 'Gerimis beku lebat',
  61: 'Hujan ringan', 63: 'Hujan sedang', 65: 'Hujan lebat', 66: 'Hujan beku', 67: 'Hujan beku lebat',
  71: 'Salju ringan', 73: 'Salju', 75: 'Salju lebat', 77: 'Butiran salju',
  80: 'Hujan lokal ringan', 81: 'Hujan lokal sedang', 82: 'Hujan lokal sangat lebat',
  85: 'Hujan salju ringan', 86: 'Hujan salju lebat',
  95: 'Hujan petir', 96: 'Hujan petir & es', 99: 'Hujan petir & es lebat',
};
const wxText = (c) => WX_TEXT[c] || 'Berawan';
function skyClass(code, isDay) {
  const k = iconKind(code);
  if (k === 'storm') return 'sky-storm';
  if (['rain', 'heavy', 'drizzle', 'snow'].includes(k)) return 'sky-rain';
  if (k === 'clear' || k === 'mostly') return isDay ? 'sky-clear-day' : 'sky-clear-night';
  return isDay ? 'sky-cloud-day' : 'sky-cloud-night';
}

/* ===================== Utilitas waktu & angin ===================== */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function dateParts(iso) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; }
const hhmm = (iso) => iso.slice(11, 16).replace(':', '.');
const ARAH = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
const arah = (deg) => ARAH[Math.round(((deg % 360) / 45)) % 8];
function beaufort(kmh) {
  const t = [[1, 'tenang'], [6, 'hampir tenang'], [12, 'sepoi-sepoi'], [20, 'lemah'], [29, 'sedang'], [39, 'segar'], [50, 'kuat'], [62, 'sangat kuat'], [75, 'badai kecil'], [Infinity, 'badai']];
  return t.find(([lim]) => kmh < lim)[1];
}
const arrowSvg = (deg) => `<svg class="arr" viewBox="0 0 24 24" style="transform:rotate(${(deg + 180) % 360}deg)" aria-hidden="true"><path d="M12 2l6 18-6-4-6 4z" fill="currentColor"/></svg>`;

/* ===================== ISPU (Indeks Standar Pencemar Udara, PermenLHK P.14/2020) ===================== */
const BP = {
  pm25: [[0, 15.5, 0, 50], [15.5, 55.4, 50, 100], [55.4, 150.4, 100, 200], [150.4, 250.4, 200, 300], [250.4, 500, 300, 500]],
  pm10: [[0, 50, 0, 50], [50, 150, 50, 100], [150, 350, 100, 200], [350, 420, 200, 300], [420, 500, 300, 500]],
};
function ispuOf(c, bp) {
  if (c == null || Number.isNaN(c)) return null;
  for (const [cl, ch, il, ih] of bp) if (c <= ch) return Math.round(il + ((c - cl) * (ih - il)) / (ch - cl));
  return 500;
}
const ispu = (pm25, pm10) => { const v = [ispuOf(pm25, BP.pm25), ispuOf(pm10, BP.pm10)].filter((x) => x != null); return v.length ? Math.max(...v) : null; };
function ispuCat(v) {
  if (v <= 50) return { name: 'Baik', color: '#2ecc71', advice: 'Udara bagus untuk aktivitas di luar ruangan.' };
  if (v <= 100) return { name: 'Sedang', color: '#3b82f6', advice: 'Masih aman. Orang yang sangat sensitif sebaiknya tidak terlalu lama beraktivitas berat di luar.' };
  if (v <= 200) return { name: 'Tidak sehat', color: '#facc15', advice: 'Kurangi aktivitas berat di luar. Pakai masker bila perlu, terutama anak, lansia, dan penderita asma.' };
  if (v <= 300) return { name: 'Sangat tidak sehat', color: '#ef4444', advice: 'Hindari aktivitas di luar ruangan. Tutup jendela dan pakai masker N95 bila harus keluar.' };
  return { name: 'Berbahaya', color: '#111111', advice: 'Tetap di dalam ruangan. Ikuti arahan pemerintah setempat.' };
}

/* ===================== Lokasi ===================== */
function haversine(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function upsertPlace(p) {
  const near = state.places.find((q) => haversine(q, p) < 2);
  if (near) { Object.assign(near, { last: Date.now() }, p.name && !near.fav ? { name: p.name, admin: p.admin, country: p.country } : {}); return near; }
  const np = { id: 'p' + Date.now().toString(36), fav: false, last: Date.now(), ...p };
  state.places.push(np);
  // Riwayat dibatasi 15 tempat non-favorit terbaru
  const hist = state.places.filter((q) => !q.fav).sort((a, b) => b.last - a.last);
  hist.slice(15).forEach((q) => { state.places.splice(state.places.indexOf(q), 1); });
  return np;
}
const savePlaces = () => LS.set('cuaca.places', state.places);
const placeLabel = (p) => [p.name, p.admin].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

function getGPS() {
  return new Promise((res, rej) => {
    if (!('geolocation' in navigator)) return rej(Object.assign(new Error('Browser tidak mendukung GPS'), { code: 'nogeo' }));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) }),
      (e) => rej(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
async function reverseName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`);
    const j = await r.json();
    const name = j.locality || j.city || j.principalSubdivision || 'Lokasi saya';
    const admin = (j.city && j.city !== name ? j.city : '') || j.principalSubdivision || '';
    return { name, admin, country: j.countryName || '' };
  } catch {
    return { name: 'Lokasi saya', admin: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, country: '' };
  }
}
async function searchPlaces(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=id&format=json`);
  const j = await r.json();
  return (j.results || []).map((x) => ({
    name: x.name, admin: [x.admin3, x.admin2, x.admin1].filter((a) => a && a !== x.name).slice(0, 2).join(', '),
    country: x.country || '', lat: +x.latitude.toFixed(4), lon: +x.longitude.toFixed(4),
  }));
}

/* ===================== Ambil data ===================== */
const WX_URL = (lat, lon) => 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
  latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 8,
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max',
  minutely_15: 'precipitation', forecast_minutely_15: 32,
});
const AQ_URL = (lat, lon) => 'https://air-quality-api.open-meteo.com/v1/air-quality?' + new URLSearchParams({
  latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 7,
  current: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
  hourly: 'pm10,pm2_5',
});
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Server cuaca membalas ' + r.status);
  return r.json();
}
const cacheKey = (p) => `cuaca.data.${p.lat},${p.lon}`;

async function loadWeather(place, { force = false } = {}) {
  state.place = place;
  renderLocBar();
  const cached = LS.get(cacheKey(place), null);
  if (cached) { Object.assign(state, { wx: cached.wx, aq: cached.aq, fetchedAt: cached.at }); render(); }
  if (cached && !force && Date.now() - cached.at < 15 * 60 * 1000) return;
  if (!cached) showLoading(true);
  try {
    const [wx, aq] = await Promise.all([getJSON(WX_URL(place.lat, place.lon)), getJSON(AQ_URL(place.lat, place.lon)).catch(() => null)]);
    if (state.place !== place) return; // lokasi sudah diganti saat menunggu
    Object.assign(state, { wx, aq, fetchedAt: Date.now() });
    LS.set(cacheKey(place), { wx, aq, at: state.fetchedAt });
    render();
  } catch (e) {
    if (cached) toast(navigator.onLine ? 'Gagal memperbarui — menampilkan data terakhir.' : 'Sedang offline — menampilkan data terakhir.');
    else showError(navigator.onLine ? 'Gagal mengambil data cuaca. ' + esc(e.message) : 'Kamu sedang offline dan belum ada data tersimpan untuk lokasi ini.');
  } finally { showLoading(false); }
}

/* ===================== Render ===================== */
function showLoading(on) { $('#loading').hidden = !on; if (on) { $('#content').hidden = true; $('#errorBox').hidden = true; } }
function showError(msg) {
  const b = $('#errorBox');
  b.innerHTML = `⚠️ ${msg}<br><button class="pill" id="retryBtn">Coba lagi</button> <button class="pill" id="errCompat">Cek kompatibilitas</button>`;
  b.hidden = false; $('#content').hidden = true;
  $('#retryBtn').onclick = () => state.place && loadWeather(state.place, { force: true });
  $('#errCompat').onclick = () => window.AmajingCompat && window.AmajingCompat.open();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); }

function renderLocBar() {
  const p = state.place;
  $('#locName').textContent = p ? placeLabel(p) : 'Pilih lokasi';
  $('#locDot').classList.toggle('gps', state.active?.mode === 'gps');
}
function renderUpdated() {
  if (!state.fetchedAt) return;
  const d = new Date(state.fetchedAt);
  const mins = Math.round((Date.now() - state.fetchedAt) / 60000);
  $('#updatedTxt').textContent = `Diperbarui ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}` + (mins >= 60 ? ` (${Math.floor(mins / 60)} jam lalu)` : '');
}

function render() {
  const { wx } = state;
  if (!wx) return;
  $('#errorBox').hidden = true; $('#content').hidden = false;
  if (state.day >= wx.daily.time.length) state.day = 0;
  renderUpdated();
  renderNowcast();
  renderHero();
  renderDays();
  renderDayDetail();
  renderExtra();
}

function nowIndex() {
  const h = state.wx.hourly.time, cur = state.wx.current.time.slice(0, 13);
  const i = h.findIndex((t) => t.slice(0, 13) === cur);
  return i < 0 ? 0 : i;
}

function renderNowcast() {
  const { wx } = state, box = $('#nowcast');
  const m = wx.minutely_15;
  if (!m || !m.time) { box.hidden = true; return; }
  box.hidden = false;
  const cur = wx.current.time;
  let s = m.time.findIndex((t) => t >= cur);
  if (s < 0) s = 0;
  if (s > 0 && m.time[s] > cur) s -= 1;
  const N = 16; // 4 jam
  const t = m.time.slice(s, s + N), p = m.precipitation.slice(s, s + N).map((v) => v || 0);
  const wet = (v) => v >= 0.05;
  const first = p.findIndex(wet);
  if (first < 0) {
    const hi = state.wx.hourly; const ni = nowIndex();
    const next = hi.precipitation.slice(ni + 4, ni + 24).findIndex((v) => v >= 0.2);
    const later = next >= 0 ? ` Kemungkinan hujan mulai sekitar pukul ${hhmm(hi.time[ni + 4 + next])}.` : '';
    box.innerHTML = `<div class="nc-none"><span class="big">🌂</span><div><p class="nc-title">Tidak ada hujan dalam 4 jam ke depan</p><p class="nc-sub" style="margin:0">Aman untuk keluar.${later}</p></div></div>`;
    return;
  }
  const level = (v) => (v < 0.6 ? 'ringan' : v < 1.9 ? 'sedang' : 'lebat');
  const maxv = Math.max(...p);
  const lastWet = p.length - 1 - [...p].reverse().findIndex(wet);
  const continues = lastWet === p.length - 1;
  const endT = continues ? t[t.length - 1] : (t[lastWet + 1] || t[lastWet]);
  let title, sub;
  if (first === 0) {
    title = 'Sedang hujan di sekitarmu';
    sub = continues ? `Hujan ${level(maxv)} diperkirakan berlanjut lewat pukul ${hhmm(endT)}` : `Hujan ${level(maxv)}, diperkirakan reda sekitar pukul ${hhmm(endT)}`;
  } else {
    title = `Hujan diperkirakan sekitar pukul ${hhmm(t[first])}`;
    const minLv = level(Math.min(...p.filter(wet)));
    const lv = minLv === level(maxv) ? level(maxv) : `${minLv} hingga ${level(maxv)}`;
    sub = `Hujan ${lv} mulai ${hhmm(t[first])}` + (continues ? `, berlanjut lewat pukul ${hhmm(endT)}` : `, reda sekitar ${hhmm(endT)}`);
  }
  const bars = p.map((v, i) => {
    const h = v <= 0 ? 0 : Math.min(100, v < 0.6 ? 12 + (v / 0.6) * 21 : v < 1.9 ? 33 + ((v - 0.6) / 1.3) * 33 : 66 + Math.min(1, (v - 1.9) / 3) * 34);
    return `<span style="height:${h}%" title="${hhmm(t[i])}: ${fmt1(v)} mm"></span>`;
  }).join('');
  const ax = [0, 4, 8, 12].filter((i) => t[i]).map((i) => `<span>${hhmm(t[i])}</span>`).join('');
  box.innerHTML = `<p class="nc-title">🌧️ ${title}</p><p class="nc-sub">${sub}</p>
    <div class="nc-chart"><div class="nc-levels"><span>Lebat</span><span>Sedang</span><span>Ringan</span></div>
    <div class="nc-bars">${bars}</div><div class="nc-axis">${ax}</div></div>`;
}

function renderHero() {
  const c = state.wx.current, d = state.wx.daily;
  const el = $('#hero');
  el.className = 'card hero ' + skyClass(c.weather_code, c.is_day);
  el.innerHTML = `<div class="hero-top">
      <div><div class="now-label">Sekarang</div>
        <div class="now-temp"><span class="t">${Math.round(c.temperature_2m)}°</span>${wxIcon(c.weather_code, c.is_day)}</div></div>
      <div class="now-desc"><div class="d">${wxText(c.weather_code)}</div>
        <div class="f">Terasa seperti ${Math.round(c.apparent_temperature)}°</div>
        <div class="hl">↑${Math.round(d.temperature_2m_max[0])}° ↓${Math.round(d.temperature_2m_min[0])}°</div></div>
    </div>`;
}

function dayName(i) {
  if (i === 0) return 'Hari ini';
  if (i === 1) return 'Besok';
  return HARI[dateParts(state.wx.daily.time[i]).dow];
}
function renderDays() {
  const d = state.wx.daily;
  $('#days').innerHTML = d.time.map((iso, i) => {
    const { d: dd, m } = dateParts(iso);
    const pp = d.precipitation_probability_max[i];
    return `<button class="day ${i === state.day ? 'sel' : ''}" data-i="${i}" aria-pressed="${i === state.day}">
      <span><span class="dn">${dayName(i)}</span><br><span class="dd">${dd} ${BULAN[m - 1]}</span></span>
      ${wxIcon(d.weather_code[i], 1)}
      <span class="desc">${wxText(d.weather_code[i])}${pp ? `<small>💧 ${pp}% · ${fmt1(d.precipitation_sum[i])} mm</small>` : ''}</span>
      <span class="mm">${Math.round(d.temperature_2m_max[i])}° <span class="lo">/ ${Math.round(d.temperature_2m_min[i])}°</span></span>
    </button>`;
  }).join('');
}

// Indeks jam untuk hari terpilih: hari ini = mulai sekarang s/d 24 jam ke depan, hari lain = 00–23
function hourRange() {
  const h = state.wx.hourly;
  if (state.day === 0) { const s = nowIndex(); return { s, e: Math.min(h.time.length, s + 25) }; }
  const date = state.wx.daily.time[state.day];
  const s = h.time.findIndex((t) => t.startsWith(date));
  return { s, e: s + 24 };
}
function dayHours() {
  const date = state.wx.daily.time[state.day];
  const idx = [];
  state.wx.hourly.time.forEach((t, i) => { if (t.startsWith(date)) idx.push(i); });
  return idx;
}
const colLabel = (i, first) => (state.day === 0 && i === first ? 'Skrg' : hhmm(state.wx.hourly.time[i]));

function renderDayDetail() {
  const h = state.wx.hourly;
  const { s, e } = hourRange();
  const ids = []; for (let i = s; i < e; i++) ids.push(i);
  const isToday = state.day === 0;
  $('#hourTitle').textContent = `Per jam — ${isToday ? 'hari ini' : dayName(state.day).toLowerCase()}`;
  const col = (i, inner) => `<div class="hcol ${isToday && i === s ? 'now' : ''}">${inner}</div>`;

  // Ringkasan per jam
  $('#hourly').innerHTML = `<div class="hrow">${ids.map((i) => col(i, `
    <span class="tmp">${Math.round(h.temperature_2m[i])}°</span>
    <span class="pp">${h.precipitation_probability[i] ? h.precipitation_probability[i] + '%' : ''}</span>
    ${wxIcon(h.weather_code[i], h.is_day[i])}
    <span class="tm">${colLabel(i, s)}</span>`)).join('')}</div>`;

  const dh = dayHours();
  const sum = (arr) => dh.reduce((a, i) => a + (arr[i] || 0), 0);
  const ref = isToday ? s : dh[12] ?? s; // jam acuan untuk ringkasan

  // Curah hujan
  const amt = state.wx.daily.precipitation_sum[state.day] ?? sum(h.precipitation);
  const mmTxt = (v) => (!v ? '–' : v < 0.1 ? '&lt;0,1' : fmt1(v));
  $('#sumRain').textContent = isToday ? `${h.precipitation_probability[s] ?? 0}%` : `${state.wx.daily.precipitation_probability_max[state.day] ?? 0}%`;
  $('#bodyRain').innerHTML = `<p class="acc-head">Total ${isToday ? 'hari ini' : dayName(state.day).toLowerCase()} <b>${fmt1(amt)} mm</b></p>
    <div class="hscroll" data-sync><div class="hrow">${ids.map((i) => col(i, `
      <span class="v">${mmTxt(h.precipitation[i])}</span>
      <span class="ppbar"><i style="height:${h.precipitation_probability[i] || 0}%"></i></span>
      <span class="pc">${h.precipitation_probability[i] ?? 0}%</span>
      <span class="tm">${colLabel(i, s)}</span>`)).join('')}</div></div>`;

  // Angin
  const maxW = Math.max(...dh.map((i) => h.wind_speed_10m[i]));
  const nowW = isToday ? state.wx.current.wind_speed_10m : h.wind_speed_10m[ref];
  const nowD = isToday ? state.wx.current.wind_direction_10m : h.wind_direction_10m[ref];
  $('#sumWind').textContent = `${Math.round(nowW)} km/j`;
  $('#bodyWind').innerHTML = `<p class="acc-head">Tertinggi ${isToday ? 'hari ini' : ''} <b>${Math.round(maxW)} km/j, ${beaufort(maxW)}</b> · ${isToday ? 'sekarang' : 'siang'} dari ${arah(nowD)}</p>
    <div class="hscroll" data-sync><div class="hrow">${ids.map((i) => col(i, `
      <span class="sp">${Math.round(h.wind_speed_10m[i])}</span>
      <span title="Dari ${arah(h.wind_direction_10m[i])}">${arrowSvg(h.wind_direction_10m[i])}</span>
      <span class="tm">${colLabel(i, s)}</span>`)).join('')}</div></div>`;

  // Kelembapan (kurva)
  const hum = ids.map((i) => h.relative_humidity_2m[i]);
  const avg = Math.round(sum(h.relative_humidity_2m) / dh.length);
  $('#sumHum').textContent = `${isToday ? state.wx.current.relative_humidity_2m : h.relative_humidity_2m[ref]}%`;
  $('#bodyHum').innerHTML = `<p class="acc-head">Rata-rata ${isToday ? 'hari ini' : ''} <b>${avg}%</b> · ${avg >= 80 ? 'lembap, terasa gerah' : avg >= 60 ? 'cukup lembap' : 'nyaman / agak kering'}</p>
    <div class="hscroll" data-sync>${humCurve(hum, ids.map((i) => colLabel(i, s)))}</div>`;

  renderAir(ref, isToday);
  syncScroll();
}

function humCurve(vals, labels) {
  const W = 64, H = 96, top = 30, bot = 66;
  const mn = Math.min(...vals), mx = Math.max(...vals), span = Math.max(10, mx - mn);
  const pts = vals.map((v, i) => [i * W + W / 2, bot - ((v - mn) / span) * (bot - top)]);
  let d = `M0 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0] + W / 2} ${last[1]}`;
  const w = vals.length * W;
  return `<svg class="curve" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">
    <path d="${d}" fill="none" stroke="#8ab4f8" stroke-width="2.5"/>
    ${pts.map(([x, y], i) => `<text x="${x}" y="${y - 10}" fill="#e8eaed" font-size="13" text-anchor="middle">${vals[i]}%</text>`).join('')}
    ${labels.map((l, i) => `<text x="${i * W + W / 2}" y="${H - 4}" fill="${i === 0 && state.day === 0 ? '#e8eaed' : '#9aa0a6'}" font-weight="${i === 0 && state.day === 0 ? 700 : 400}" font-size="13" text-anchor="middle">${l}</text>`).join('')}
  </svg>`;
}

function renderAir(ref, isToday) {
  const aq = state.aq, body = $('#bodyAir');
  if (!aq || !aq.hourly) { $('#sumAir').textContent = 'tidak tersedia'; body.innerHTML = '<p class="aq-note">Data kualitas udara untuk lokasi ini sedang tidak tersedia.</p>'; return; }
  let pm25, pm10, label;
  if (isToday && aq.current) { pm25 = aq.current.pm2_5; pm10 = aq.current.pm10; label = 'sekarang'; } else {
    const date = state.wx.daily.time[state.day];
    const idx = aq.hourly.time.map((t, i) => (t.startsWith(date) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) { $('#sumAir').textContent = 'belum tersedia'; body.innerHTML = `<p class="aq-note">Prakiraan kualitas udara baru tersedia hingga ${aq.hourly.time.length / 24} hari ke depan.</p>`; return; }
    const avg = (k) => idx.reduce((a, i) => a + (aq.hourly[k][i] || 0), 0) / idx.length;
    pm25 = avg('pm2_5'); pm10 = avg('pm10'); label = 'rata-rata harian';
  }
  const v = ispu(pm25, pm10);
  if (v == null) { $('#sumAir').textContent = 'tidak tersedia'; body.innerHTML = ''; return; }
  const cat = ispuCat(v);
  $('#sumAir').innerHTML = `<span style="color:${cat.color === '#111111' ? '#fff' : cat.color}">●</span> ${v} · ${cat.name}`;
  const c = isToday ? aq.current : null;
  const pol = [['PM2.5', pm25, 'µg/m³'], ['PM10', pm10, 'µg/m³']];
  if (c) pol.push(['O₃', c.ozone, 'µg/m³'], ['NO₂', c.nitrogen_dioxide, 'µg/m³'], ['SO₂', c.sulphur_dioxide, 'µg/m³'], ['CO', c.carbon_monoxide, 'µg/m³']);
  body.innerHTML = `<div class="aq-big"><span class="n">${v}</span><span class="c">${cat.name} <small style="color:var(--muted)">(${label})</small></span></div>
    <div class="aq-scale"><span class="aq-marker" style="left:${Math.min(v, 300) / 300 * 100}%"></span></div>
    <div class="aq-ticks"><span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>250</span><span>300</span></div>
    <p class="aq-advice">${cat.advice}</p>
    <div class="aq-pol">${pol.filter((x) => x[1] != null).map(([n, val, u]) => `<div>${n}<b>${fmt1(val)}</b>${u}</div>`).join('')}</div>
    <p class="aq-note">Skala ISPU (Indeks Standar Pencemar Udara, KLHK) dihitung dari estimasi PM2.5 &amp; PM10 model global Copernicus CAMS — bukan dari stasiun pengukur terdekat. <a href="panduan.html#ispu">Arti angka ISPU</a></p>`;
}

function renderExtra() {
  const d = state.wx.daily, c = state.wx.current, i = state.day;
  const uv = d.uv_index_max[i];
  const uvTxt = uv == null ? '–' : uv < 3 ? 'rendah' : uv < 6 ? 'sedang' : uv < 8 ? 'tinggi' : uv < 11 ? 'sangat tinggi' : 'ekstrem';
  $('#extra').innerHTML = `
    <div>🌅 Matahari terbit<b>${d.sunrise[i] ? hhmm(d.sunrise[i]) : '–'}</b></div>
    <div>🌇 Terbenam<b>${d.sunset[i] ? hhmm(d.sunset[i]) : '–'}</b></div>
    <div>☀️ Indeks UV maks<b>${uv == null ? '–' : fmt1(uv)}</b>${uvTxt}</div>
    <div>🌬️ Hembusan angin<b>${Math.round(c.wind_gusts_10m)} km/j</b>sekarang</div>`;
  $('#extra').previousElementSibling.textContent = i === 0 ? 'Info lain hari ini' : `Info lain — ${dayName(i).toLowerCase()}`;
}

// Semua baris per jam ikut bergeser bersamaan
function syncScroll() {
  const els = [...document.querySelectorAll('.hscroll[data-sync]')];
  let busy = false;
  els.forEach((el) => {
    el.scrollLeft = 0;
    el.onscroll = () => {
      if (busy) return; busy = true;
      els.forEach((o) => { if (o !== el) o.scrollLeft = el.scrollLeft; });
      requestAnimationFrame(() => { busy = false; });
    };
  });
}

/* ===================== Lembar lokasi ===================== */
function openSheet(msg) {
  const m = $('#sheetMsg');
  m.hidden = !msg; m.textContent = msg || '';
  $('#searchResults').innerHTML = ''; $('#searchInput').value = '';
  renderPlaceLists();
  $('#sheetBg').hidden = false;
}
const closeSheet = () => { $('#sheetBg').hidden = true; };
function placeItem(p, { saved = true } = {}) {
  const active = state.place && saved && state.place.id === p.id;
  return `<li><button class="pick ${active ? 'active' : ''}" data-pick="${esc(p.id || '')}" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${esc(p.name)}" data-admin="${esc(p.admin)}" data-country="${esc(p.country)}">
      ${active ? '✓ ' : ''}${esc(p.name)}<small>${esc([p.admin, p.country].filter(Boolean).join(' · '))}</small></button>
    ${saved ? `<button class="ib ${p.fav ? 'on' : ''}" data-fav="${p.id}" aria-label="${p.fav ? 'Hapus dari favorit' : 'Jadikan favorit'}">${p.fav ? '★' : '☆'}</button>
    <button class="ib" data-del="${p.id}" aria-label="Hapus">🗑</button>` : ''}</li>`;
}
function renderPlaceLists() {
  const favs = state.places.filter((p) => p.fav).sort((a, b) => a.name.localeCompare(b.name));
  const hist = state.places.filter((p) => !p.fav).sort((a, b) => b.last - a.last);
  $('#favList').innerHTML = favs.map((p) => placeItem(p)).join('') || '<li class="empty">Belum ada. Ketuk ☆ untuk menyimpan tempat yang sering kamu kunjungi (rumah, kantor, kampung halaman).</li>';
  $('#histList').innerHTML = hist.map((p) => placeItem(p)).join('') || '<li class="empty">Tempat yang pernah kamu lihat akan muncul di sini.</li>';
}
function selectPlace(p, mode = 'place') {
  const saved = upsertPlace(p);
  savePlaces();
  state.active = { mode, id: saved.id };
  LS.set('cuaca.active', state.active);
  state.day = 0;
  closeSheet();
  loadWeather(saved, { force: false });
}
async function useGPS({ silent = false } = {}) {
  if (!silent) toast('Mencari lokasimu…');
  try {
    const pos = await getGPS();
    const near = state.places.find((q) => haversine(q, pos) < 2);
    const meta = near ? { name: near.name, admin: near.admin, country: near.country } : await reverseName(pos.lat, pos.lon);
    selectPlace({ ...pos, ...meta }, 'gps');
    return true;
  } catch (e) {
    const msg = e.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi di setelan browser, atau cari lokasimu secara manual di bawah.'
      : e.code === 'nogeo' ? 'Browser ini tidak mendukung GPS. Cari lokasimu secara manual.'
        : 'Lokasi tidak bisa ditemukan (GPS mati / sinyal lemah). Nyalakan GPS atau cari manual.';
    if (silent) return false;
    openSheet(msg);
    return false;
  }
}

function bindUI() {
  $('#locBtn').onclick = () => openSheet();
  $('#sheetClose').onclick = closeSheet;
  $('#sheetBg').addEventListener('click', (e) => { if (e.target.id === 'sheetBg') closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  $('#gpsBtn').onclick = () => useGPS();
  $('#refreshBtn').onclick = async () => {
    if (state.active?.mode === 'gps') { const ok = await useGPS({ silent: true }); if (ok) { loadWeather(state.place, { force: true }); return; } }
    if (state.place) { toast('Memperbarui…'); loadWeather(state.place, { force: true }); }
  };
  $('#days').onclick = (e) => {
    const b = e.target.closest('.day'); if (!b) return;
    state.day = +b.dataset.i;
    renderDays(); renderDayDetail(); renderExtra();
    $('#hourTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#compatBtn').onclick = () => (window.AmajingCompat ? window.AmajingCompat.open() : toast('Pemeriksa kompatibilitas belum siap, coba lagi.'));

  // Cari lokasi
  let qT;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(qT);
    const q = e.target.value.trim();
    if (q.length < 2) { $('#searchResults').innerHTML = ''; return; }
    qT = setTimeout(async () => {
      $('#searchResults').innerHTML = '<li class="empty">Mencari…</li>';
      try {
        const res = await searchPlaces(q);
        $('#searchResults').innerHTML = res.map((p) => placeItem(p, { saved: false })).join('') || '<li class="empty">Tidak ditemukan. Coba nama kota atau kecamatan terdekat.</li>';
      } catch { $('#searchResults').innerHTML = '<li class="empty">Gagal mencari — periksa koneksi internet.</li>'; }
    }, 350);
  });
  $('.sheet').addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    const fav = e.target.closest('[data-fav]');
    const del = e.target.closest('[data-del]');
    if (fav) {
      const p = state.places.find((q) => q.id === fav.dataset.fav);
      if (p) { p.fav = !p.fav; savePlaces(); renderPlaceLists(); toast(p.fav ? `⭐ ${p.name} disimpan ke favorit` : `${p.name} dihapus dari favorit`); }
    } else if (del) {
      state.places = state.places.filter((q) => q.id !== del.dataset.del); savePlaces(); renderPlaceLists();
    } else if (pick) {
      const d = pick.dataset;
      const existing = d.pick && state.places.find((q) => q.id === d.pick);
      selectPlace(existing || { name: d.name, admin: d.admin, country: d.country, lat: +d.lat, lon: +d.lon });
    }
  });

  // Simpan status buka/tutup akordeon
  const accState = LS.get('cuaca.acc', {});
  document.querySelectorAll('details.acc').forEach((el) => {
    if (accState[el.id] === false) el.open = false;
    el.addEventListener('toggle', () => { accState[el.id] = el.open; LS.set('cuaca.acc', accState); if (el.open) syncScroll(); });
  });

  setInterval(renderUpdated, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.place && Date.now() - state.fetchedAt > 30 * 60 * 1000) loadWeather(state.place);
  });
}

/* ===================== Pasang aplikasi (PWA) ===================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('✅ Amajing Cuaca terpasang!'); });
$('#installBtn').onclick = async () => {
  if (!deferredPrompt) { location.href = 'panduan.html#pasang'; return; }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null; $('#installBtn').hidden = true;
};
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* mode offline tidak tersedia */ });
}

/* ===================== Mulai ===================== */
async function start() {
  bindUI();
  const act = state.active;
  const saved = act && state.places.find((p) => p.id === act.id);
  if (saved) {
    loadWeather(saved);
    if (act.mode === 'gps') useGPS({ silent: true }); // ikuti posisi HP terkini tanpa mengganggu
    return;
  }
  const ok = await useGPS({ silent: true });
  if (!ok) {
    selectPlace({ name: 'Jakarta', admin: 'DKI Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 });
    openSheet('Lokasimu belum terdeteksi, jadi kami tampilkan Jakarta dulu. Ketuk “Gunakan lokasi saya” atau cari kotamu.');
  }
}
window.__amajingCuacaReady = true;
start();
