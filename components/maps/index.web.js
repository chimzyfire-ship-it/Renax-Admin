import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Switched to vivid, real-life map colors via standard OpenStreetMap tiles.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const htmlSnippet = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Live Map</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>
body { margin: 0; padding: 0; background: #e5e5e5; }
#map { position: absolute; top: 0; bottom: 0; width: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false }).setView([4.8156, 6.9926], 13);

  // Use vivid open street map tiles for "real life map" textures and colors.
  L.tileLayer('${TILE_URL}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
  }).addTo(map);
</script>
</body>
</html>
`;

export default function MapView({ style, ...props }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1, backgroundColor: '#e5e5e5' }, style]} {...props}>
        <iframe
          srcDoc={htmlSnippet}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Live Tracker Map"
          allow="geolocation"
        />
      </View>
    );
  }
  return <View style={[{ flex: 1, backgroundColor: '#e5e5e5' }, style]} />;
}

export const Marker = () => null;
export const Polyline = () => null;
export const PROVIDER_DEFAULT = 'default';
