
async function loadPlaces(){
  const res = await fetch('data/places.json');
  return await res.json();
}
async function init(){
  const tbody = document.querySelector('#archiveTable tbody');
  const places = await loadPlaces();
  places.forEach(p=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.title}</td><td>${p.city||''}</td><td>${p.type}</td><td>${p.risk}</td>`;
    tbody.appendChild(tr);
  });
}
init();
