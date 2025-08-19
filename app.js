// Basic state
let map, markersLayer;
let data = [];

// Icons per categoria
const icons = {
  abbandonato: new L.Icon({iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]}),
  street_art: new L.Icon({iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-violet.png', iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]}),
  hall_of_fame: new L.Icon({iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-green.png', iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]}),
  muro_legale: new L.Icon({iconUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-gold.png', iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]})
};

async function loadData() {
  try {
    const res = await fetch('data/places.json');
    data = await res.json();
  } catch(e) {
    console.warn('No data file, using empty list', e);
    data = [];
  }
}

function initMap() {
  map = L.map('map', {zoomControl: true}).setView([45.4642, 9.19], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
}

function renderMarkers() {
  markersLayer.clearLayers();
  const term = document.getElementById('search').value.toLowerCase().trim();
  const checks = [...document.querySelectorAll('.flt:checked')];
  const typeAllowed = new Set(checks.filter(c=>c.dataset.key==='type').map(c=>c.value));
  const riskAllowed = new Set(checks.filter(c=>c.dataset.key==='risk').map(c=>c.value));

  data.filter(p => {
    const matchTerm = !term || (p.title?.toLowerCase().includes(term) || (p.city||'').toLowerCase().includes(term) || (p.tags||[]).join(' ').toLowerCase().includes(term));
    const matchType = typeAllowed.has(p.type);
    const matchRisk = riskAllowed.has(p.risk || 'medio');
    return matchTerm && matchType && matchRisk;
  }).forEach(p => {
    const marker = L.marker([p.lat, p.lng], {icon: icons[p.type] || icons.abbandonato}).addTo(markersLayer);
    marker.bindPopup(`<h3>${p.title} <span class="badge">${p.city||''}</span></h3>
      <div>${badges(p)}</div>
      <p>${sanitize(p.desc||'')}</p>
      <button class="btn small" onclick="openSidebar('${p.id}')">Dettagli</button>
    `);
  });
}

function badges(p){
  const tags = (p.tags||[]).map(t=>`<span class="tag">#${sanitize(t)}</span>`).join(' ');
  const legal = p.legal ? 'Permesso confermato' : 'Permesso non confermato';
  const risk = (p.risk||'medio').toUpperCase();
  return `<span class="badge">${p.type}</span> <span class="badge">${legal}</span> <span class="badge">Rischio: ${risk}</span> ${tags}`;
}

function sanitize(str){ return (str||'').replace(/[<>]/g, c => ({'<':'&lt;','>':'&gt;'}[c])); }

function openSidebar(id){
  const p = data.find(x=>x.id===id);
  if(!p) return;
  const el = document.getElementById('placeDetails');
  el.innerHTML = `
    <h2>${sanitize(p.title)}</h2>
    <p class="muted">${sanitize(p.city||'')}</p>
    <div>${badges(p)}</div>
    <p>${sanitize(p.desc||'')}</p>
    ${gallery(p.images||[])}
    ${p.links ? `<p>Link: ${p.links.map(u=>`<a href="${u}" target="_blank" rel="noopener">Fonte</a>`).join(' • ')}</p>`:''}
    <hr>
    <details>
      <summary>Segnala correzione / rimuovi</summary>
      <p>Scrivi a: <a href="mailto:moderazione@kala.example">moderazione@kala.example</a> con ID <code>${p.id}</code>.</p>
    </details>
  `;
  document.getElementById('sidebar').classList.add('open');
}

function gallery(imgs){
  if(!imgs.length) return '<p class="muted">Nessuna foto.</p>';
  return `<div class="gallery">` + imgs.map(src=>`<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="foto luogo"></a>`).join('') + `</div>`;
}

document.getElementById('closeSidebar').addEventListener('click', ()=>document.getElementById('sidebar').classList.remove('open'));
document.getElementById('search').addEventListener('input', renderMarkers);
document.querySelectorAll('.flt').forEach(cb=>cb.addEventListener('change', renderMarkers));

document.getElementById('openDisclaimer').addEventListener('click', (e)=>{e.preventDefault();document.getElementById('legalModal').classList.remove('hidden')});
document.getElementById('closeLegal').addEventListener('click', ()=>document.getElementById('legalModal').classList.add('hidden'));

document.getElementById('locate').addEventListener('click', ()=>{
  if(!navigator.geolocation){alert('Geolocalizzazione non supportata');return;}
  navigator.geolocation.getCurrentPosition((pos)=>{
    const {latitude, longitude} = pos.coords;
    map.setView([latitude, longitude], 14);
    L.circle([latitude, longitude], {radius: 80}).addTo(map);
  }, (err)=> alert('Impossibile ottenere posizione: '+err.message), {enableHighAccuracy:true, timeout:8000, maximumAge:0});
});

// Add point workflow
document.getElementById('addPoint').addEventListener('click', ()=>{
  alert('Tocca la mappa per inserire un punto. I dati resteranno in locale finché non esporti il JSON.');
  const once = (e)=>{
    const latlng = e.latlng;
    map.off('click', once);
    const title = prompt('Titolo luogo (es. Ex fabbrica, Hall of Fame, murale XY)');
    if(!title) return;
    const city = prompt('Città/Quartiere');
    const desc = prompt('Descrizione (no invito a violare la legge)');
    const type = prompt('Tipo: abbandonato | street_art | hall_of_fame | muro_legale', 'street_art') || 'street_art';
    const risk = prompt('Rischio: basso | medio | alto', 'medio') || 'medio';
    const legal = confirm('Permesso confermato? OK = sì, Annulla = no');
    const id = 'loc_' + Date.now();
    const p = {id, title, city, desc, type, risk, legal, lat: latlng.lat, lng: latlng.lng, tags:[], images:[], links:[]};
    data.push(p);
    // Persist to localStorage
    localStorage.setItem('kala_user_points', JSON.stringify(getUserPoints()));
    renderMarkers();
  };
  map.on('click', once);
});

function getUserPoints(){
  return data.filter(p=>p.id.startsWith('loc_'));
}

document.getElementById('exportData').addEventListener('click', ()=>{
  const userPoints = getUserPoints();
  const blob = new Blob([JSON.stringify(userPoints, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kala_user_points.json';
  a.click();
  URL.revokeObjectURL(url);
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.hidden = false;
  btn.addEventListener('click', async ()=>{
    btn.disabled = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    btn.hidden = true;
  }, {once:true});
});

// Boot
(async function(){
  await loadData();
  initMap();
})();
