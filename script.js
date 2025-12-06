/* -----------------------------------------------------------
   FEUERWEHRKARTE B3 – SCRIPT.JS (TEIL 1 + TEIL 2)
   Enthält: Grundlogik + Layer + Datenmodell + Rendering +
            Popup (Verschieben/Löschen/Entfernung) + Suche/Liste
----------------------------------------------------------- */

/* ---------- Karte & Basiskacheln ---------- */
let map = L.map('map').setView([47.45, 9.92], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap-Mitwirkende'
}).addTo(map);

/* ---------- Datenmodell ---------- */
let data = {
  toCheck: [],     // Hydranten zur Überprüfung
  confirmed: []    // Bestätigte Hydranten
};

/* ---------- Icons (rot = prüfen, grün = bestätigt) ---------- */
const iconRed = L.divIcon({
  html: `<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#d9534f" stroke="#000"/></svg>`,
  iconSize: [28, 28], iconAnchor: [14, 28]
});
const iconGreen = L.divIcon({
  html: `<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2ea44f" stroke="#000"/></svg>`,
  iconSize: [28, 28], iconAnchor: [14, 28]
});

/* ---------- Layergruppen ---------- */
let layerToCheck = L.layerGroup().addTo(map);
let layerConfirmed = L.layerGroup().addTo(map);

/* ---------- LocalStorage (load/save) ---------- */
function saveData() {
  localStorage.setItem("feuerwehr_b3_data", JSON.stringify(data));
}
function loadData() {
  let raw = localStorage.getItem("feuerwehr_b3_data");
  if (raw) {
    try { data = JSON.parse(raw); }
    catch (e) { console.error("Fehler beim Laden von Daten:", e); }
  }
}

/* ---------- Hilfsfunktionen ---------- */
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000; const toRad = Math.PI/180;
  const dLat = (lat2 - lat1)*toRad; const dLon = (lon2 - lon1)*toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* ---------- Render-Funktionen ---------- */
function renderAll(){
  layerToCheck.clearLayers(); layerConfirmed.clearLayers();
  document.getElementById('listToCheck').innerHTML = ''; 
  document.getElementById('listConfirmed').innerHTML = '';
  data.toCheck.forEach((p,i)=> renderPoint(p,'toCheck',i));
  data.confirmed.forEach((p,i)=> renderPoint(p,'confirmed',i));
  attachListClickHandlers(); // sorgt dafür, dass Listen klickbar sind
}

function renderPoint(p, type, index){
  const icon = (type==='confirmed') ? iconGreen : iconRed;
  const group = (type==='confirmed') ? layerConfirmed : layerToCheck;

  // Marker
  const marker = L.marker([p.lat, p.lng], { icon }).addTo(group);

  // Popup-HTML (Buttons rufen globale Funktionen auf)
  const popupHtml = makePopupHtml(p, type, index);
  marker.bindPopup(popupHtml);

  // Listenelement
  const el = document.createElement('div');
  el.className = 'list-item';
  el.dataset.type = type;
  el.dataset.index = index;
  el.innerHTML = `<strong>${escapeHtml(p.name||'Hydrant')}</strong><div class="coords">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`;
  document.getElementById(type==='toCheck'?'listToCheck':'listConfirmed').appendChild(el);
}

/* Popup-HTML-Erzeugung */
function makePopupHtml(p, type, index){
  const btnMoveLabel = (type==='toCheck') ? 'Als bestätigt markieren' : 'Zur Überprüfung zurück';
  // Buttons rufen window-Funktionen auf, damit sie aus Popup heraus funktionieren
  return `<b>${escapeHtml(p.name||'Hydrant')}</b><br>
          ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br><br>
          <button onclick="moveHydrant('${type}',${index})">${btnMoveLabel}</button>
          <button onclick="deleteHydrant('${type}',${index})">Löschen</button>
          <button onclick="distanceTo(${p.lat},${p.lng})">Entfernung</button>`;
}

/* ---------- Interaktion: Verschieben / Löschen / Entfernung ---------- */
/* Verschiebt einen Hydranten in den jeweils anderen Layer */
window.moveHydrant = function(type, index){
  const src = (type==='toCheck') ? data.toCheck : data.confirmed;
  if(!src || !src[index]) return alert('Eintrag nicht gefunden');
  const item = src.splice(index,1)[0];
  if(type==='toCheck') data.confirmed.push(item); else data.toCheck.push(item);
  saveData(); renderAll();
};

/* Löscht einen Hydranten */
window.deleteHydrant = function(type, index){
  if(!confirm('Eintrag löschen?')) return;
  const arr = (type==='toCheck') ? data.toCheck : data.confirmed;
  arr.splice(index,1);
  saveData(); renderAll();
};

/* Entfernung (Luftlinie) zur aktuellen Position anzeigen */
window.distanceTo = function(lat,lng){
  if(!currentPos) return alert('Bitte zuerst "Meine Position" drücken.');
  const d = haversine(currentPos.lat, currentPos.lng, lat, lng);
  if(d>=1000) alert('Luftlinie: ' + (d/1000).toFixed(2) + ' km ('+Math.round(d)+' m)');
  else alert('Luftlinie: ' + Math.round(d) + ' m');
};

/* ---------- Suchfunktion (Filter der Listenelemente) ---------- */
document.getElementById('search')?.addEventListener('input', function(e){
  const q = (e.target.value || '').toLowerCase();
  document.querySelectorAll('.list-item').forEach(div=>{
    const text = (div.textContent || '').toLowerCase();
    div.style.display = text.indexOf(q) === -1 ? 'none' : 'block';
  });
});

/* ---------- Listen-Click-Handler (Fokus auf Karte) ---------- */
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

/* ---------- Basis: Laden + Rendern ---------- */
loadData();
renderAll();

/* ---------- Position (GPS) ---------- */
let currentPos = null;
document.getElementById('locBtn').addEventListener('click', ()=>{
  if(!navigator.geolocation) return alert('Geolocation nicht unterstützt');
  navigator.geolocation.getCurrentPosition(pos=>{
    currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    L.circle([currentPos.lat, currentPos.lng], { radius: 8, color: '#2b7be4' }).addTo(map);
    map.setView([currentPos.lat, currentPos.lng], 16);
  }, err=>{ alert('Position nicht verfügbar: ' + err.message); });
});

/* ---------- Marker hinzufügen (einfacher Modus) ---------- */
let adding = false;
const addBtn = document.getElementById('addBtn');
addBtn.addEventListener('click', ()=>{
  adding = !adding;
  addBtn.textContent = adding ? 'Klick auf Karte: Platzieren' : '➕ Hydrant setzen';
  if(adding) alert('Klicke jetzt auf die Karte, um den Hydranten zu setzen.');
});

/* Klick auf Karte -> Hydranten erzeugen */
map.on('click', function(e){
  if(!adding) return;
  const name = prompt('Name des Hydranten:','Hydrant');
  if(!name){ adding = false; addBtn.textContent = '➕ Hydrant setzen'; return; }
  const obj = { name, lat: e.latlng.lat, lng: e.latlng.lng, created: (new Date()).toISOString() };
  data.toCheck.push(obj);
  saveData(); renderAll();
  adding = false; addBtn.textContent = '➕ Hydrant setzen';
});

/* ---------- Expose small API for console debugging ---------- */
window.__fw = { data, renderAll, saveData, loadData };
