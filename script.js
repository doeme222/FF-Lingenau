/* --- Anpassungen: dynamische Icons, Panel-Collapse, Auto-Locate, Distanz & Schläuche --- */

// 1) Icon-Fabrik: erstellt Icons abhängig von Zoom
function makeIcon(color, zoom) {
  // Basisgröße (px) bei Zoom 13 ~28. Skalierung linear mit Zoom, begrenzt.
  const base = 28;
  const scale = Math.max(0.5, Math.min(1.6, zoom / 13)); // 0.5..1.6
  const size = Math.round(base * scale);
  const fill = (color === 'green') ? '#2ea44f' : '#d9534f';
  return L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="${fill}" stroke="#000"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size/2), size]
  });
}

// helper: get current zoom and create icons
function iconForType(type) {
  const z = map.getZoom();
  return (type === 'confirmed') ? makeIcon('green', z) : makeIcon('red', z);
}

// 2) Re-implement renderPoint to use iconForType and show dynamic popup content including distance & hoses
function renderPoint(p, type, index){
  const icon = iconForType(type);
  const group = (type==='confirmed')?layerConfirmed:layerToCheck;

  // create marker
  const marker = L.marker([p.lat, p.lng], { icon }).addTo(group);

  // create popup content including distance/hose info if currentPos known
  const popupHtml = makePopupHtmlWithDistance(p, type, index);
  marker.bindPopup(popupHtml);

  // list item
  const el = document.createElement('div');
  el.className = 'list-item';
  el.dataset.type = type;
  el.dataset.index = index;
  el.innerHTML = `<strong>${escapeHtml(p.name||'Hydrant')}</strong><div class="coords">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`;
  document.getElementById(type==='toCheck'?'listToCheck':'listConfirmed').appendChild(el);
}

// 3) Popup Html mit Distanzen und Schlauch-Berechnung
function makePopupHtmlWithDistance(p, type, index){
  let distHtml = '';
  if(currentPos){
    const d = haversine(currentPos.lat, currentPos.lng, p.lat, p.lng); // in meters
    const dText = d >= 1000 ? (d/1000).toFixed(2) + ' km' : Math.round(d) + ' m';
    // Schläuche: exakte Dezimalzahl und aufgerundet (Anzahl Schläuche mit je 20m)
    const hosesExact = d / 20;
    const hosesRounded = Math.ceil(hosesExact);
    const hosesDisplay = hosesRounded + ' (≈ ' + hosesExact.toFixed(1) + ')';
    distHtml = `<div style="margin-bottom:6px;font-weight:600">Entfernung: ${dText}<br>Benötigte 20m-Schläuche: ${hosesDisplay}</div>`;
  } else {
    distHtml = `<div style="margin-bottom:6px;color:#666">Keine Position verfügbar — zuerst „Meine Position“ drücken</div>`;
  }
  const btnMoveLabel = (type==='toCheck') ? 'Als bestätigt markieren' : 'Zur Überprüfung zurück';
  return `<div>${distHtml}</div>
    <b>${escapeHtml(p.name||'Hydrant')}</b><br>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br><br>
    <button onclick="moveHydrant('${type}',${index})">${btnMoveLabel}</button>
    <button onclick="deleteHydrant('${type}',${index})">Löschen</button>
    <button onclick="distanceTo(${p.lat},${p.lng})">Entfernung</button>`;
}

// 4) Zoom-Handler: beim Zoomen neu rendern, damit Icons skaliert werden
map.on('zoomend', function(){
  // einfache Strategie: rerender komplett
  renderAll();
});

// 5) Panel collapse: füge Toggle-Button (falls noch nicht vorhanden) und Logik ein
(function ensurePanelToggle(){
  if(!document.getElementById('panelToggleBtn')){
    const btn = document.createElement('button');
    btn.id = 'panelToggleBtn';
    btn.textContent = 'Hydranten ▾';
    btn.style.marginLeft = '6px';
    btn.className = 'btn';
    // fügen in topbar (falls vorhanden)
    const top = document.getElementById('topbar');
    if(top) top.appendChild(btn);
    // toggle-Funktion
    btn.addEventListener('click', function(){
      const panel = document.getElementById('panel');
      if(!panel) return;
      const collapsed = panel.classList.toggle('collapsed');
      localStorage.setItem('fw_panel_collapsed', collapsed ? '1' : '0');
    });
    // initial state nach localStorage
    const collapsedState = localStorage.getItem('fw_panel_collapsed');
    if(collapsedState === '1'){
      const panel = document.getElementById('panel');
      if(panel) panel.classList.add('collapsed');
    }
  }
})();

// 6) Auto-Locate beim Laden (fragt Berechtigung)
(function autoLocateOnLoad(){
  // verzögert starten, damit UI geladen ist
  setTimeout(()=>{
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos=>{
      currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      L.circle([currentPos.lat, currentPos.lng], { radius:8, color:'#2b7be4' }).addTo(map);
      map.setView([currentPos.lat, currentPos.lng], 14);
      // Re-render damit Popups zeigen gleich Distanz
      renderAll();
    }, err=>{
      console.warn('Auto-locate abgelehnt/Fehler:', err);
    }, { timeout: 10000 });
  }, 800);
})();

// 7) distanceTo-Funktion bleibt, popup nutzt jetzt currentPos (bereits vorhanden)
window.distanceTo = function(lat,lng){
  if(!currentPos) return alert('Bitte zuerst "Meine Position" drücken.');
  const d = haversine(currentPos.lat, currentPos.lng, lat, lng);
  const dText = d >= 1000 ? (d/1000).toFixed(2) + ' km' : Math.round(d) + ' m';
  const hosesExact = d / 20;
  const hosesRounded = Math.ceil(hosesExact);
  alert('Entfernung: ' + dText + '\nBenötigte 20m-Schläuche: ' + hosesRounded + ' (≈ ' + hosesExact.toFixed(1) + ')');
};
