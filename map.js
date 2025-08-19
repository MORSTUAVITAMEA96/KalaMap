
async function loadPlaces(){
  const res = await fetch('data/places.json');
  return await res.json();
}
async function init(){
  const map = L.map('map').setView([45.4642,9.19], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'© OpenStreetMap'
  }).addTo(map);
  const cluster = L.markerClusterGroup();
  const places = await loadPlaces();
  places.forEach(p=>{
    const marker = L.marker([p.lat,p.lng]);
    marker.bindPopup(`<b>${p.title}</b><br>${p.city||''}<br>${p.type} • rischio ${p.risk}`);
    cluster.addLayer(marker);
  });
  map.addLayer(cluster);
}
init();
