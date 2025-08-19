
let map, markersLayer, cluster;
let data = [];
let proposals = JSON.parse(localStorage.getItem('kala_proposals')||'[]');

// Custom icons
const icon = (name)=> L.icon({iconUrl:`assets/marker-${name}.svg`, iconSize:[32,46], iconAnchor:[16,46], popupAnchor:[0,-40]});

// Load data
async function loadData(){
  try{
    const res = await fetch('data/places.json', {cache:'no-store'});
    data = await res.json();
  }catch(e){
    console.warn('Data load failed', e); data = [];
  }
}

// Map init
function initMap(){
  const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:20, attribution:'&copy; OpenStreetMap'});
  const baseCarto = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {subdomains:'abcd', maxZoom:20, attribution:'&copy; CartoDB'});
  map = L.map('map', {zoomControl:false, fullscreenControl:true, layers:[baseCarto]}).setView([45.4642,9.19], 12);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.control.scale({imperial:false}).addTo(map);
  L.control.layers({"Carto Dark":baseCarto,"OSM Standard":baseOSM},{}, {position:'topleft'}).addTo(map);

  // Geocoder
  if (window.L.Control && L.Control.Geocoder){
    const geocoder = L.Control.geocoder({defaultMarkGeocode:false}).addTo(map);
    geocoder.on('markgeocode', (e)=>{
      map.fitBounds(e.geocode.bbox);
    });
  }

  cluster = L.markerClusterGroup({showCoverageOnHover:false, spiderfyOnEveryZoom:false, chunkedLoading:true});
  markersLayer = cluster;
  map.addLayer(cluster);

  renderMarkers();
  addLegend();
}

function addLegend(){
  const div = L.DomUtil.create('div', 'legend card');
  div.innerHTML = `
    <div class="item"><span class="dot" style="background:#60a5fa"></span> Street Art</div>
    <div class="item"><span class="dot" style="background:#f59e0b"></span> Muro legale</div>
    <div class="item"><span class="dot" style="background:#34d399"></span> Hall of Fame</div>
    <div class="item"><span class="dot" style="background:#f472b6"></span> Abbandonato (perimetro)</div>
  `;
  L.control({position:'bottomleft'}).onAdd = ()=>div;
  L.control({position:'bottomleft'}).addTo(map);
}

function renderMarkers(){
  cluster.clearLayers();
  const term = document.getElementById('search').value.toLowerCase().trim();
  const checks = [...document.querySelectorAll('.flt:checked')];
  const typeAllowed = new Set(checks.filter(c=>c.dataset.key==='type').map(c=>c.value));
  const riskAllowed = new Set(checks.filter(c=>c.dataset.key==='risk').map(c=>c.value));
  const legalOnly = document.getElementById('legalOnly')?.checked;

  [...data, ...proposals.map(p=>({...p, _proposal:true}))]
  .filter(p=>{
    const t = (p.title||'') + ' ' + (p.city||'') + ' ' + (p.tags||[]).join(' ');
    const matchTerm = !term || t.toLowerCase().includes(term);
    const matchType = typeAllowed.has(p.type);
    const matchRisk = riskAllowed.has(p.risk||'medio');
    const matchLegal = !legalOnly || !!p.legal;
    return matchTerm && matchType && matchRisk && matchLegal;
  })
  .forEach(p=>{
    const m = L.marker([p.lat, p.lng], {icon: icon(p.type||'street_art')});
    const imgs = (p.images||[]).slice(0,3).map(src=>`<img src="${src}" style="width:100%;border-radius:8px;border:1px solid #333;margin:6px 0">`).join('');
    const origin = p._proposal ? '<span class="badge">bozza locale</span>' : '';
    m.bindPopup(`<div class="card">
      <h3 style="margin:0 0 6px 0">${sanitize(p.title)} ${origin}</h3>
      <div>${badges(p)}</div>
      <p>${sanitize(p.desc||'')}</p>
      ${imgs}
      <div class="row">
        <button class="btn small" onclick="openSidebar('${p.id??''}','${p._proposal?'proposal':'data'}')">Dettagli</button>
        <button class="btn small" onclick="startEdit('${p.id??''}','${p._proposal?'proposal':'data'}')">Modifica</button>
      </div>
    </div>`);
    cluster.addLayer(m);
  });
}

function badges(p){
  const tags = (p.tags||[]).map(t=>`<span class="tag">#${sanitize(t)}</span>`).join(' ');
  const legal = p.legal ? 'Permesso confermato' : 'Permesso non confermato';
  const risk = (p.risk||'medio').toUpperCase();
  return `<span class="badge">${p.type}</span> <span class="badge">${legal}</span> <span class="badge">Rischio: ${risk}</span> ${tags}`;
}

function sanitize(str){ return (str||'').replace(/[<>]/g, c => ({'<':'&lt;','>':'&gt;'}[c])); }

function findItem(id, source){
  const arr = source==='proposal' ? proposals : data;
  return [arr, arr.find(x=>x.id===id)];
}

window.openSidebar = function(id, source='data'){
  const [arr, p] = findItem(id, source);
  if(!p) return;
  const el = document.getElementById('placeDetails');
  const imgs = (p.images||[]).map(src=>`<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt=""></a>`).join('');
  el.innerHTML = `
    <h2>${sanitize(p.title)}</h2>
    <p class="muted">${sanitize(p.city||'')}</p>
    <div>${badges(p)}</div>
    <p>${sanitize(p.desc||'')}</p>
    <div class="gallery">${imgs || '<p class="muted">Nessuna foto.</p>'}</div>
    ${p.links ? `<p>Link: ${p.links.map(u=>`<a href="\${u}" target="_blank" rel="noopener">Fonte</a>`).join(' • ')}</p>`:''}
    <hr>
    <div class="row">
      <button class="btn small" onclick="startEdit('${p.id}','${source}')">Modifica</button>
      ${source==='proposal' ? `<button class="btn small" onclick="deleteProposal('${p.id}')">Elimina bozza</button>`:''}
    </div>
  `;
  document.getElementById('sidebar').classList.add('open');
}

document.getElementById('closeSidebar').addEventListener('click', ()=>document.getElementById('sidebar').classList.remove('open'));
document.getElementById('search').addEventListener('input', renderMarkers);
document.querySelectorAll('.flt').forEach(cb=>cb.addEventListener('change', renderMarkers));

// Extra controls
const legalToggle = document.createElement('label');
legalToggle.className='toggle'; legalToggle.innerHTML = '<input type="checkbox" id="legalOnly"> Solo permesso confermato';
document.querySelector('.filters.row').appendChild(legalToggle);
document.getElementById('legalOnly').addEventListener('change', renderMarkers);

// Geolocation
document.getElementById('locate').addEventListener('click', ()=>{
  if(!navigator.geolocation){alert('Geolocalizzazione non supportata');return;}
  navigator.geolocation.getCurrentPosition((pos)=>{
    const {latitude, longitude} = pos.coords;
    map.setView([latitude, longitude], 15);
    L.circle([latitude, longitude], {radius: 60}).addTo(map);
  }, (err)=> alert('Impossibile ottenere posizione: '+err.message), {enableHighAccuracy:true, timeout:8000, maximumAge:0});
});

// Add point quick
document.getElementById('addPoint').addEventListener('click', ()=>{
  alert('Tocca la mappa per inserire un punto locale (bozza).');
  const once = (e)=>{
    map.off('click', once);
    const latlng = e.latlng;
    openProposalModal({lat:latlng.lat, lng:latlng.lng});
  };
  map.on('click', once);
});

// Export data (user proposals only)
document.getElementById('exportData').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(proposals, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kala_proposals.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Proposal modal
function openProposalModal(seed={}){
  const modal = document.getElementById('proposalModal');
  modal.classList.remove('hidden');
  const form = document.getElementById('proposalForm');
  form.reset();
  form.dataset.lat = seed.lat || '';
  form.dataset.lng = seed.lng || '';
  form.dataset.id = seed.id || ('loc_'+Date.now());
  document.getElementById('proposalPreview').innerHTML='';

  const fileInput = document.getElementById('proposalFiles');
  fileInput.onchange = async ()=>{
    const files = [...fileInput.files];
    const previews = [];
    for (const f of files){
      const b64 = await fileToDataURL(f);
      previews.push(b64);
    }
    const prev = document.getElementById('proposalPreview');
    prev.innerHTML = previews.map(src=>`<img src="${src}">`).join('');
    prev.dataset.images = JSON.stringify(previews);
  };
}

document.getElementById('proposeBtn').addEventListener('click', ()=>openProposalModal());
document.getElementById('cancelProposal').addEventListener('click', ()=>document.getElementById('proposalModal').classList.add('hidden'));
document.getElementById('saveProposal').addEventListener('click', ()=>{
  const form = document.getElementById('proposalForm');
  const fd = new FormData(form);
  const id = form.dataset.id;
  const p = {
    id,
    title: fd.get('title')||'Senza titolo',
    city: fd.get('city')||'',
    type: fd.get('type')||'street_art',
    risk: fd.get('risk')||'medio',
    legal: fd.get('legal')==='on',
    lat: parseFloat(form.dataset.lat||'45.4642'),
    lng: parseFloat(form.dataset.lng||'9.19'),
    desc: fd.get('desc')||'',
    tags: (fd.get('tags')||'').split(',').map(s=>s.trim()).filter(Boolean),
    images: (fd.get('images')||'').split(',').map(s=>s.trim()).filter(Boolean),
    links: []
  };
  const extraImgs = JSON.parse(document.getElementById('proposalPreview').dataset.images||'[]');
  p.images = [...p.images, ...extraImgs];
  proposals = proposals.filter(x=>x.id!==id).concat([p]);
  localStorage.setItem('kala_proposals', JSON.stringify(proposals));
  document.getElementById('proposalModal').classList.add('hidden');
  renderMarkers();
});

function deleteProposal(id){
  proposals = proposals.filter(x=>x.id!==id);
  localStorage.setItem('kala_proposals', JSON.stringify(proposals));
  renderMarkers();
}

// Simple edit flow
window.startEdit = function(id, source='data'){
  const [arr, p] = findItem(id, source);
  if(!p) return;
  const div = document.getElementById('editBody');
  div.innerHTML = `
    <div class="form-grid">
      <input id="e_title" value="${sanitize(p.title||'')}">
      <input id="e_city" value="${sanitize(p.city||'')}">
      <select id="e_type">
        <option value="street_art">Street Art</option>
        <option value="muro_legale">Muro legale</option>
        <option value="hall_of_fame">Hall of Fame</option>
        <option value="abbandonato">Abbandonato</option>
      </select>
      <select id="e_risk">
        <option value="basso">basso</option><option value="medio">medio</option><option value="alto">alto</option>
      </select>
      <label class="row"><input type="checkbox" id="e_legal" ${p.legal?'checked':''}> Permesso confermato</label>
      <textarea id="e_desc" rows="4">${sanitize(p.desc||'')}</textarea>
      <input id="e_tags" value="${(p.tags||[]).join(', ')}">
      <input id="e_images" value="${(p.images||[]).join(', ')}" placeholder="URL immagini separati da virgola">
    </div>
  `;
  document.getElementById('e_type').value = p.type||'street_art';
  document.getElementById('e_risk').value = p.risk||'medio';

  document.getElementById('editModal').classList.remove('hidden');

  document.getElementById('saveEdit').onclick = ()=>{
    const updated = {
      ...p,
      title: document.getElementById('e_title').value,
      city: document.getElementById('e_city').value,
      type: document.getElementById('e_type').value,
      risk: document.getElementById('e_risk').value,
      legal: document.getElementById('e_legal').checked,
      desc: document.getElementById('e_desc').value,
      tags: document.getElementById('e_tags').value.split(',').map(s=>s.trim()).filter(Boolean),
      images: document.getElementById('e_images').value.split(',').map(s=>s.trim()).filter(Boolean),
    };
    if (source==='proposal'){
      proposals = proposals.map(x=> x.id===p.id ? updated : x);
      localStorage.setItem('kala_proposals', JSON.stringify(proposals));
    } else {
      alert('Questa modifica è solo locale. Per rendere permanente, modifica data/places.json nel repo.');
      const idx = data.findIndex(x=>x.id===p.id);
      if(idx>=0) data[idx]=updated;
    }
    document.getElementById('editModal').classList.add('hidden');
    renderMarkers();
  };
};
document.getElementById('cancelEdit').addEventListener('click', ()=>document.getElementById('editModal').classList.add('hidden'));

// Importer
document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importModal').classList.remove('hidden'));
document.getElementById('cancelImport').addEventListener('click', ()=>document.getElementById('importModal').classList.add('hidden'));
document.getElementById('runImport').addEventListener('click', ()=>{
  const txt = document.getElementById('importText').value.trim();
  if(!txt) return;
  let arr=[];
  try{
    if (txt.startsWith('[') || txt.startsWith('{')){
      const json = JSON.parse(txt);
      arr = Array.isArray(json) ? json : (json.places || []);
    } else {
      arr = csvToArray(txt);
    }
  }catch(e){
    alert('Formato non valido: '+e.message); return;
  }
  arr.forEach((p,i)=>{
    p.id = p.id || ('imp_'+Date.now()+'_'+i);
    p.tags = Array.isArray(p.tags) ? p.tags : ((''+(p.tags||'')).split(',').map(s=>s.trim()).filter(Boolean));
    p.lat = parseFloat(p.lat); p.lng = parseFloat(p.lng);
    p.legal = (p.legal===true) || (p.legal==='true') || (p.legal==='1');
    p.risk = p.risk||'medio'; p.type = p.type||'street_art';
  });
  proposals = proposals.concat(arr);
  localStorage.setItem('kala_proposals', JSON.stringify(proposals));
  document.getElementById('importModal').classList.add('hidden');
  renderMarkers();
});

// Geocoder button focuses control
document.getElementById('geocodeBtn').addEventListener('click', ()=>{
  const el = document.querySelector('.leaflet-control-geocoder input');
  if(el){ el.focus(); el.select(); }
});

function csvToArray(text){
  const rows = text.split(/\r?\n/).filter(Boolean);
  const headers = rows.shift().split(',').map(s=>s.trim());
  return rows.map(line=>{
    const cols = line.split(',').map(s=>s.trim());
    const obj = {};
    headers.forEach((h,i)=> obj[h]=cols[i]);
    return obj;
  });
}

function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Legal modal
document.getElementById('openDisclaimer').addEventListener('click', (e)=>{e.preventDefault();document.getElementById('legalModal').classList.remove('hidden')});
document.getElementById('closeLegal').addEventListener('click', ()=>document.getElementById('legalModal').classList.add('hidden'));

// Boot
(async function(){
  await loadData();
  initMap();
})();
