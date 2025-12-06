/* script.js — Teil 1: Grundlogik, Layer, Datenmodell, Laden/Speichern, Render */
let map = L.map('map').setView([47.45,9.92], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap-Mitwirkende'
}).addTo(map);

// Datenmodell
let data = { toCheck: [], confirmed: [] };

// Icons (inline SVG)
const iconRed = L.divIcon({
  html:`<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#d9534f" stroke="#000"/></svg>`,
  iconSize:[28,28], iconAnchor:[14,28]
});
const iconGreen = L.divIcon({
  html:`<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2ea44f" stroke="#000"/></svg>`,
  iconSize:[28,28], iconAnchor:[14,28]
});

// Layergruppen
let layerToCheck = L.layerGroup().addTo(map);
let layerConfirmed = L.layerGroup().addTo(map);

// load/save
function saveData(){ localStorage.setItem('feuerwehr_b3_data', JSON.stringify(data)); }
function loadData(){ let raw = localStorage.getItem('feuerwehr_b3_data'); if(raw){ try{ data = JSON.parse(raw); }catch(e){ console.error('loadData error',e); } } }

// Rendering
function renderAll(){
  layerToCheck.clearLayers(); layerConfirmed.clearLayers();
  document.getElementById('listToCheck').innerHTML=''; document.getElementById('listConfirmed').innerHTML='';
  data.toCheck.forEach((p,i)=> renderPoint(p,'toCheck',i));
  data.confirmed.forEach((p,i)=> renderPoint(p,'confirmed',i));
}

function renderPoint(p,type,index){
  const icon = (type==='confirmed')?iconGreen:iconRed;
  const group = (type==='confirmed')?layerConfirmed:layerToCheck;
  const marker = L.marker([p.lat,p.lng],{icon}).addTo(group);
  marker.bindPopup(`<b>${escapeHtml(p.name||'Hydrant')}</b><br>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
  // list
  const el = document.createElement('div');
  el.className='list-item';
  el.innerHTML = `<strong>${escapeHtml(p.name||'Hydrant')}</strong><div class="coords">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`;
  el.onclick = ()=> map.setView([p.lat,p.lng],17);
  document.getElementById(type==='toCheck'?'listToCheck':'listConfirmed').appendChild(el);
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Basis: load + render
loadData();
renderAll();

// Position anzeigen
let currentPos=null;
document.getElementById('locBtn').addEventListener('click', ()=>{
  if(!navigator.geolocation){ alert('Geolocation nicht unterstützt'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    currentPos={lat:pos.coords.latitude, lng:pos.coords.longitude};
    L.circle([currentPos.lat,currentPos.lng],{radius:8,color:'#2b7be4'}).addTo(map);
    map.setView([currentPos.lat,currentPos.lng],16);
  }, err=>{ alert('Position nicht verfügbar: '+err.message); });
});

// Marker hinzufügen (einfacher Modus)
let adding=false;
document.getElementById('addBtn').addEventListener('click', ()=>{
  adding = !adding;
  document.getElementById('addBtn').textContent = adding ? 'Klick auf Karte: Platzieren' : '➕ Hydrant setzen';
  if(adding) alert('Klicke auf die Karte, um den Hydranten zu setzen.');
});

map.on('click', e=>{
  if(!adding) return;
  const name = prompt('Name des Hydranten:','Hydrant');
  if(!name){ adding=false; document.getElementById('addBtn').textContent='➕ Hydrant setzen'; return; }
  const obj = { name, lat: e.latlng.lat, lng: e.latlng.lng, created: (new Date()).toISOString() };
  // Standardmäßig in toCheck
  data.toCheck.push(obj); saveData(); renderAll();
  adding=false; document.getElementById('addBtn').textContent='➕ Hydrant setzen';
});
