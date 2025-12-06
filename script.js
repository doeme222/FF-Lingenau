/* FEUERWEHRKARTE B3 – script.js (mit automatischem GeoJSON-Load) */
/* Enthält Teile 1+2 plus automatisches Laden von hydranten.geojson, 
   falls localStorage noch leer ist. */

let map = L.map('map').setView([47.45, 9.92], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap-Mitwirkende'
}).addTo(map);

/* Datenmodell */
let data = { toCheck: [], confirmed: [] };

/* Icons */
const iconRed = L.divIcon({
  html: `<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#d9534f" stroke="#000"/></svg>`,
  iconSize: [28, 28], iconAnchor: [14, 28]
});
const iconGreen = L.divIcon({
  html: `<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2ea44f" stroke="#000"/></svg>`,
  iconSize: [28, 28], iconAnchor: [14, 28]
});

/* Layergruppen */
let layerToCheck = L.layerGroup().addTo(map);
let layerConfirmed = L.layerGroup().addTo(map);

/* LocalStorage */
function saveData() { localStorage.setItem("feuerwehr_b3_data", JSON.stringify(data)); }
function loadData() {
  let raw = localStorage.getItem("feuerwehr_b3_data");
  if (raw) {
    try { data = JSON.parse(raw); }
    catch (e) { console.error("Fehler beim Laden von Daten:", e); }
  }
}

/* Helper functions */
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000; const toRad = Math.PI/180;
  const dLat = (lat2 - lat1)*toRad; const dLon = (lon2 - lon1)*toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* Render */
function renderAll(){
  layerToCheck.clearLayers(); layerConfirmed.clearLayers();
  document.getElementById('listToCheck').innerHTML = ''; 
  document.getElementById('listConfirmed').innerHTML = '';
  data.toCheck.forEach((p,i)=> renderPoint(p,'toCheck',i));
  data.confirmed.forEach((p,i)=> renderPoint(p,'confirmed',i));
  attachListClickHandlers();
}

function renderPoint(p, type, index){
  const icon = (type==='confirmed') ? iconGreen : iconRed;
  const group = (type==='confirmed') ? layerConfirmed : layerToCheck;
  const marker = L.marker([p.lat, p.lng], { icon }).addTo(group);
  const popupHtml = makePopupHtml(p, type, index);
  marker.bindPopup(popupHtml);
  const el = document.createElement('div');
  el.className = 'list-item';
  el.dataset.type = type;
  el.dataset.index = index;
  el.innerHTML = `<strong>${escapeHtml(p.name||'Hydrant')}</strong><div class="coords">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`;
  document.getElementById(type==='toCheck'?'listToCheck':'listConfirmed').appendChild(el);
}

function makePopupHtml(p, type, index){
  const btnMoveLabel = (type==='toCheck') ? 'Als bestätigt markieren' : 'Zur Überprüfung zurück';
  return `<b>${escapeHtml(p.name||'Hydrant')}</b><br>
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br><br>
          <button onclick="moveHydrant('${type}',${index})">${btnMoveLabel}</button>
          <button onclick="deleteHydrant('${type}',${index})">Löschen</button>
          <button onclick="distanceTo(${p.lat},${p.lng})">Entfernung</button>`;
}

/* Actions */
window.moveHydrant = function(type, index){
  const src = (type==='toCheck') ? data.toCheck : data.confirmed;
  if(!src || !src[index]) return alert('Eintrag nicht gefunden');
  const item = src.splice(index,1)[0];
  if(type==='toCheck') data.confirmed.push(item); else data.toCheck.push(item);
  saveData(); renderAll();
};

window.deleteHydrant = function(type, index){
  if(!confirm('Eintrag löschen?')) return;
  const arr = (type==='toCheck') ? data.toCheck : data.confirmed;
  arr.splice(index,1);
  saveData(); renderAll();
};

window.distanceTo = function(lat,lng){
  if(!currentPos) return alert('Bitte zuerst "Meine Position" drücken.');
  const d = haversine(currentPos.lat, currentPos.lng, lat, lng);
  if(d>=1000) alert('Luftlinie: ' + (d/1000).toFixed(2) + ' km ('+Math.round(d)+' m)');
  else alert('Luftlinie: ' + Math.round(d) + ' m');
};

/* Search */
document.getElementById('search')?.addEventListener('input', function(e){
  const q = (e.target.value || '').toLowerCase();
  document.querySelectorAll('.list-item').forEach(div=>{
    const text = (div.textContent || '').toLowerCase();
    div.style.display = text.indexOf(q) === -1 ? 'none' : 'block';
  });
});

function attachListClickHandlers(){
  document.querySelectorAll('.list-item').forEach(div=>{
    div.onclick = function(){
      const type = this.dataset.type;
      const index = parseInt(this.dataset.index,10);
      const arr = (type==='toCheck') ? data.toCheck : data.confirmed;
      if(!arr || !arr[index]) return;
      map.setView([arr[index].lat, arr[index].lng], 17);
    };
  });
}

/* Load existing data, then if empty load hydranten.geojson from server */
loadData();
if((!data.toCheck || data.toCheck.length===0) && (!data.confirmed || data.confirmed.length===0)){
  // try to fetch hydranten.geojson from site root
  fetch('hydranten.geojson')
    .then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(geo=>{
      if(geo && geo.type==='FeatureCollection' && Array.isArray(geo.features)){
        geo.features.forEach(f=>{
          if(f.geometry && f.geometry.type==='Point'){
            const [lng,lat] = f.geometry.coordinates;
            const name = (f.properties && (f.properties.name||f.properties.NOTE||f.properties.note)) || 'Hydrant';
            data.toCheck.push({ name, lat, lng, created: new Date().toISOString() });
          }
        });
        saveData();
        renderAll();
      } else {
        console.warn('Keine gültige GeoJSON geliefert');
      }
    })
    .catch(err=>{
      console.warn('hydranten.geojson konnte nicht geladen werden:', err);
    });
} else {
  renderAll();
}

/* Position */
let currentPos = null;
document.getElementById('locBtn').addEventListener('click', ()=>{
  if(!navigator.geolocation) return alert('Geolocation nicht unterstützt');
  navigator.geolocation.getCurrentPosition(pos=>{
    currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    L.circle([currentPos.lat, currentPos.lng], { radius: 8, color: '#2b7be4' }).addTo(map);
    map.setView([currentPos.lat, currentPos.lng], 16);
  }, err=>{ alert('Position nicht verfügbar: ' + err.message); });
});

/* Adding markers */
let adding = false;
const addBtn = document.getElementById('addBtn');
addBtn.addEventListener('click', ()=>{
  adding = !adding;
  addBtn.textContent = adding ? 'Klick auf Karte: Platzieren' : '➕ Hydrant setzen';
  if(adding) alert('Klicke jetzt auf die Karte, um den Hydranten zu setzen.');
});

map.on('click', function(e){
  if(!adding) return;
  const name = prompt('Name des Hydranten:','Hydrant');
  if(!name){ adding = false; addBtn.textContent = '➕ Hydrant setzen'; return; }
  const obj = { name, lat: e.latlng.lat, lng: e.latlng.lng, created: (new Date()).toISOString() };
  data.toCheck.push(obj);
  saveData(); renderAll();
  adding = false; addBtn.textContent = '➕ Hydrant setzen';
});

/* Export/Import (basic) */
document.getElementById('exportBtn')?.addEventListener('click', ()=>{
  const features = [];
  data.toCheck.forEach(p=> features.push({ type:'Feature', properties:{layer:'toCheck', name:p.name, created:p.created}, geometry:{type:'Point', coordinates:[p.lng,p.lat]} }));
  data.confirmed.forEach(p=> features.push({ type:'Feature', properties:{layer:'confirmed', name:p.name, created:p.created}, geometry:{type:'Point', coordinates:[p.lng,p.lat]} }));
  const geo = { type:'FeatureCollection', features };
  const blob = new Blob([JSON.stringify(geo,null,2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='hydranten_export.geojson'; a.click();
});

document.getElementById('importBtn')?.addEventListener('click', ()=> document.getElementById('fileInput').click());
document.getElementById('fileInput')?.addEventListener('change', function(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ()=> {
    try {
      const geo = JSON.parse(r.result);
      if(geo.type==='FeatureCollection'){
        geo.features.forEach(fe=>{
          if(fe.geometry && fe.geometry.type==='Point'){
            const [lng,lat] = fe.geometry.coordinates;
            const layer = fe.properties && fe.properties.layer==='confirmed' ? 'confirmed' : 'toCheck';
            const name = fe.properties && (fe.properties.name||fe.properties.NOTE||fe.properties.note) || 'Hydrant';
            data[layer].push({ name, lat, lng, created: new Date().toISOString() });
          }
        });
        saveData(); renderAll();
        alert('Import abgeschlossen');
      } else alert('Keine gültige GeoJSON-Datei');
    } catch(e){ alert('Fehler beim Einlesen: '+e.message); }
  };
  r.readAsText(f);
});

/* Expose for debugging */
window.__fw = { data, renderAll, saveData, loadData };
