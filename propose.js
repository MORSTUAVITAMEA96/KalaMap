
const form = document.getElementById('proposeForm');
const container = document.getElementById('proposals');
let proposals = JSON.parse(localStorage.getItem('proposals')||'[]');

function render(){
  container.innerHTML = proposals.map(p=> `<div class="card"><b>${p.title}</b> — ${p.city||''}<br>${p.type}, rischio ${p.risk}</div>`).join('');
}
form.onsubmit = e=>{
  e.preventDefault();
  const fd = new FormData(form);
  const p = {
    id:'prop_'+Date.now(),
    title: fd.get('title'),
    city: fd.get('city'),
    type: fd.get('type'),
    risk: fd.get('risk'),
    legal: fd.get('legal')==='on',
    desc: fd.get('desc'),
    tags: (fd.get('tags')||'').split(',').map(s=>s.trim()).filter(Boolean),
    lat:45.4642, lng:9.19
  };
  proposals.push(p);
  localStorage.setItem('proposals', JSON.stringify(proposals));
  render();
  form.reset();
}
render();
