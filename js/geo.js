// OpenStreetMap Nominatim Geocoding & OSRM Driving Route Engine

// Fetch address suggestions from Nominatim API
export async function fetchAddressSuggestions(query) {
    if (!query || query.trim().length < 3) return [];
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`Geocoding HTTP error: ${response.status}`);
        const data = await response.json();
        
        return data.map(item => ({
            displayName: item.display_name,
            shortName: item.name || item.display_name.split(',')[0],
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type,
            address: item.address
        }));
    } catch (err) {
        console.error('Nominatim search error:', err);
        return [];
    }
}

// Fetch OSRM driving route between origin [lat, lng] and destination [lat, lng]
export async function fetchDrivingRoute(originLat, originLng, destLat, destLng) {
    // OSRM format is longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`OSRM HTTP error: ${response.status}`);
        
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
            throw new Error('No driving route found between these locations.');
        }

        const route = data.routes[0];
        const rawDurationMins = Math.round((route.duration / 60) * 10) / 10;
        const rawDistanceKm = Math.round((route.distance / 1000) * 10) / 10;

        // GeoJSON coordinates are [lng, lat] arrays
        const geojsonCoordinates = route.geometry.coordinates;

        // Convert coordinates to standard [lat, lng] pairs for Leaflet
        const leafletLatLngs = geojsonCoordinates.map(coord => [coord[1], coord[0]]);

        return {
            geometry: route.geometry, // GeoJSON LineString
            coordinates: leafletLatLngs,
            distanceKm: rawDistanceKm,
            durationMins: rawDurationMins,
            exceedsLimit: rawDurationMins > 20,
            legs: route.legs
        };
    } catch (err) {
        console.error('OSRM route fetching error:', err);
        throw err;
    }
}
