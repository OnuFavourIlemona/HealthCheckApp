import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MapPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: 'hospitals' | 'pharmacies' | 'labs';
  distanceKm?: number;
};

type Props = {
  userCoords: { latitude: number; longitude: number } | null;
  places: MapPlace[];
};

/**
 * Leaflet + OpenStreetMap rendered in a WebView.
 *
 * Deliberately not react-native-maps: its Google provider renders a blank
 * (black) view inside Expo Go without a Google Maps API key and a dev build.
 * This needs no API key and renders identically on both platforms.
 *
 * The HTML is loaded once and never re-sourced (WebView does not reliably
 * reload on source.html changes); markers are pushed in afterwards with
 * injectJavaScript whenever the data changes.
 */
const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#eef2f0; }
  .leaflet-control-attribution { font-size: 9px; opacity: .65; }
  .pin {
    width: 30px; height: 30px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg); display:flex; align-items:center; justify-content:center;
    box-shadow: 0 2px 6px rgba(0,0,0,.3); border: 2.5px solid #fff;
  }
  .pin span { transform: rotate(45deg); font-size: 14px; line-height: 1; }
  .pin-hospital { background: #E4572E; }
  .pin-pharmacy { background: #0E8F2F; }
  .pin-lab { background: #6C6FCF; }
  .me {
    width: 18px; height: 18px; border-radius: 50%;
    background: #16C23A; border: 3px solid #fff;
    box-shadow: 0 0 0 4px rgba(22,194,58,.25), 0 2px 5px rgba(0,0,0,.3);
  }
  .leaflet-popup-content { font-family: -apple-system, Roboto, sans-serif; margin: 10px 12px; }
  .popup-name { font-weight: 600; font-size: 13px; color: #111; }
  .popup-dist { font-size: 12px; color: #0E8F2F; margin-top: 2px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  // Neutral starting view — recentred on the user's real position as soon as
  // renderPlaces() runs, so no city is implied before GPS resolves.
  var map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([0, 20], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);

  window.renderPlaces = function (userCoords, places) {
    markerLayer.clearLayers();
    var bounds = [];

    if (userCoords) {
      L.marker([userCoords.latitude, userCoords.longitude], {
        icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18,18], iconAnchor: [9,9] })
      }).addTo(markerLayer).bindPopup('<div class="popup-name">You are here</div>');
      bounds.push([userCoords.latitude, userCoords.longitude]);
    }

    places.forEach(function (p) {
      var pinClass = p.category === 'hospitals' ? 'pin-hospital' : p.category === 'labs' ? 'pin-lab' : 'pin-pharmacy';
      var emoji = p.category === 'hospitals' ? '🏥' : p.category === 'labs' ? '🧪' : '💊';
      var html = '<div class="pin ' + pinClass + '"><span>' + emoji + '</span></div>';
      L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({ className: '', html: html, iconSize: [30,30], iconAnchor: [15,30], popupAnchor: [0,-30] })
      }).addTo(markerLayer)
        .bindPopup('<div class="popup-name">' + p.name + '</div>' +
                   (p.distance ? '<div class="popup-dist">' + p.distance + '</div>' : ''));
      bounds.push([p.latitude, p.longitude]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
    return true;
  };

  // Tell React Native the map is ready for markers.
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script>
</body>
</html>`;

export function NearbyMap({ userCoords, places }: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const pushPlaces = useCallback(() => {
    if (!webRef.current) return;
    const payload = places.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      name: p.name.replace(/'/g, "\\'"),
      category: p.category,
      distance: p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km away` : '',
    }));
    webRef.current.injectJavaScript(
      `window.renderPlaces && window.renderPlaces(${JSON.stringify(userCoords)}, ${JSON.stringify(payload)}); true;`,
    );
  }, [userCoords, places]);

  useEffect(() => {
    if (ready) pushPlaces();
  }, [ready, pushPlaces]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: HTML }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        onMessage={(event) => {
          if (event.nativeEvent.data === 'ready') setReady(true);
        }}
        onLoadEnd={() => setReady(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF2F0',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
