import { fetchAddressSuggestions, fetchDrivingRoute } from './geo.js';
import { DeliveryAnimator } from './animator.js';
import { getSavedAddresses, saveAddress, deleteAddress, getDeliveryHistory, saveDeliveryRecord } from './supabase.js';

// Pre-configured Sample Restaurants (London Central default hub)
const SAMPLE_RESTAURANTS = [
    { id: 'rest_1', name: '🍔 Burger Artisan', lat: 51.5074, lng: -0.1278, address: 'Trafalgar Square, London' },
    { id: 'rest_2', name: '🍕 Bella Italia Pizzeria', lat: 51.5136, lng: -0.1365, address: 'Soho, London' },
    { id: 'rest_3', name: '🍣 Sakura Sushi Master', lat: 51.5117, lng: -0.1240, address: 'Covent Garden, London' },
    { id: 'rest_4', name: '🌮 Taco Fiesta', lat: 51.5095, lng: -0.1478, address: 'Mayfair, London' },
    { id: 'rest_5', name: '🥗 Green Bowl Co', lat: 51.5195, lng: -0.1378, address: 'Fitzrovia, London' }
];

// CARTO Basemaps API Key (Restricted to allowed domains in CARTO Dashboard)
const CARTO_API_KEY = 'cb1_2te8_1_e16cda754e9f6f3946e5c052';

class DeliveryApp {
    constructor() {
        this.map = null;
        this.selectedRestaurant = SAMPLE_RESTAURANTS[0];
        this.currentDestination = null; // { lat, lng, displayName }
        this.activeRoute = null;

        // Markers & Polyline
        this.restaurantMarker = null;
        this.destinationMarker = null;
        this.vehicleMarker = null;
        this.routePolyline = null;

        // Animator
        this.animator = new DeliveryAnimator({
            onTick: (data) => this.handleAnimatorTick(data),
            onComplete: () => this.handleDeliveryComplete(),
            onStatusChange: (status) => this.handleStatusChange(status)
        });

        this.searchDebounceTimer = null;
        this.init();
    }

    async init() {
        this.initMap();
        this.renderRestaurantBar();
        this.bindEvents();

        // Default initial location: Big Ben area
        const defaultDest = {
            displayName: 'Big Ben, Westminster, London SW1A 0AA',
            shortName: 'Big Ben, Westminster',
            lat: 51.5007,
            lng: -0.1246
        };
        await this.setDestination(defaultDest);
    }

    initMap() {
        // Initialize Leaflet Map centered on London
        this.map = L.map('map', {
            zoomControl: false
        }).setView([51.5074, -0.1278], 14);

        // Add Leaflet zoom control on top right
        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // Add CartoDB Dark Matter Tiles for modern aesthetic
        const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' +
            (CARTO_API_KEY ? `?api_key=${CARTO_API_KEY}` : '');

        L.tileLayer(tileUrl, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Create Custom Leaflet Vehicle Icon
        this.vehicleIcon = L.divIcon({
            className: 'custom-vehicle-icon',
            html: `<div id="vehicle-icon-inner" class="vehicle-marker">🛵</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        // Create Restaurant Icon
        this.restaurantIcon = L.divIcon({
            className: 'custom-restaurant-icon',
            html: `<div class="restaurant-marker">🍳</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        // Create Customer Home Destination Icon
        this.pinIcon = L.divIcon({
            className: 'custom-pin-icon',
            html: `<div class="pin-marker">📍</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    }

    renderRestaurantBar() {
        const bar = document.getElementById('restaurant-bar');
        bar.innerHTML = '';

        SAMPLE_RESTAURANTS.forEach((rest, idx) => {
            const chip = document.createElement('button');
            chip.className = `restaurant-chip ${idx === 0 ? 'active' : ''}`;
            chip.innerHTML = rest.name;
            chip.addEventListener('click', () => {
                document.querySelectorAll('.restaurant-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.selectedRestaurant = rest;
                if (this.currentDestination) {
                    this.calculateAndDrawRoute();
                }
            });
            bar.appendChild(chip);
        });
    }

    bindEvents() {
        const addressInput = document.getElementById('address-input');
        const clearBtn = document.getElementById('clear-search-btn');
        const suggestionsDropdown = document.getElementById('suggestions-dropdown');

        // Address Search Input Keyup with Debouncing
        addressInput.addEventListener('input', (e) => {
            const val = e.target.value;
            clearBtn.style.display = val.length > 0 ? 'block' : 'none';

            clearTimeout(this.searchDebounceTimer);
            if (val.trim().length < 3) {
                suggestionsDropdown.style.display = 'none';
                return;
            }

            this.searchDebounceTimer = setTimeout(async () => {
                const results = await fetchAddressSuggestions(val);
                this.renderSuggestions(results);
            }, 300);
        });

        clearBtn.addEventListener('click', () => {
            addressInput.value = '';
            clearBtn.style.display = 'none';
            suggestionsDropdown.style.display = 'none';
        });

        // Play / Pause Toggle Button
        document.getElementById('btn-toggle-play').addEventListener('click', () => {
            if (!this.activeRoute) return;

            if (this.animator.isPlaying) {
                this.animator.pause();
                this.updatePlayButtonUI(false);
            } else {
                this.animator.start();
                this.updatePlayButtonUI(true);
            }
        });

        // Speed Multiplier Buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const speed = parseInt(btn.dataset.speed, 10);
                this.animator.setSpeed(speed);
            });
        });

        // Save Current Address Button
        document.getElementById('btn-save-current').addEventListener('click', async () => {
            if (!this.currentDestination) return;
            try {
                const label = prompt('Enter a label for this address (e.g. Home, Work, Friend):', 'Home');
                if (!label) return;
                await saveAddress(label, this.currentDestination.displayName, this.currentDestination.lat, this.currentDestination.lng);
                alert('Address saved to Supabase!');
            } catch (err) {
                alert('Could not save address. Check connection.');
            }
        });

        // Drawer Toggle Buttons
        document.getElementById('saved-addresses-btn').addEventListener('click', () => this.openSavedAddressesDrawer());
        document.getElementById('history-btn').addEventListener('click', () => this.openHistoryDrawer());
        document.getElementById('close-drawer-btn').addEventListener('click', () => {
            document.getElementById('drawer').classList.remove('open');
        });
    }

    renderSuggestions(results) {
        const dropdown = document.getElementById('suggestions-dropdown');
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        results.forEach(res => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div class="suggestion-icon">📍</div>
                <div class="suggestion-text">
                    <div class="suggestion-title">${res.shortName}</div>
                    <div class="suggestion-sub">${res.displayName}</div>
                </div>
            `;
            item.addEventListener('click', async () => {
                dropdown.style.display = 'none';
                document.getElementById('address-input').value = res.displayName;
                await this.setDestination(res);
            });
            dropdown.appendChild(item);
        });

        dropdown.style.display = 'block';
    }

    async setDestination(dest) {
        this.currentDestination = dest;
        document.getElementById('address-input').value = dest.displayName;
        document.getElementById('btn-save-current').style.display = 'inline-flex';
        await this.calculateAndDrawRoute();
    }

    async calculateAndDrawRoute() {
        if (!this.currentDestination || !this.selectedRestaurant) return;

        this.animator.stop();
        this.updatePlayButtonUI(false);

        const toast = document.getElementById('toast-warning');
        toast.style.display = 'none';

        try {
            const routeData = await fetchDrivingRoute(
                this.selectedRestaurant.lat,
                this.selectedRestaurant.lng,
                this.currentDestination.lat,
                this.currentDestination.lng
            );

            this.activeRoute = routeData;

            // Enforce max 20-min limit warning as per requirements
            if (routeData.exceedsLimit) {
                toast.style.display = 'block';
            }

            // Remove old layers
            if (this.routePolyline) this.map.removeLayer(this.routePolyline);
            if (this.restaurantMarker) this.map.removeLayer(this.restaurantMarker);
            if (this.destinationMarker) this.map.removeLayer(this.destinationMarker);
            if (this.vehicleMarker) this.map.removeLayer(this.vehicleMarker);

            // Draw route polyline
            this.routePolyline = L.polyline(routeData.coordinates, {
                color: '#ff4757',
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);

            // Fit map bounds to show route
            this.map.fitBounds(this.routePolyline.getBounds(), { padding: [80, 80] });

            // Add restaurant marker
            this.restaurantMarker = L.marker([this.selectedRestaurant.lat, this.selectedRestaurant.lng], {
                icon: this.restaurantIcon
            }).addTo(this.map).bindPopup(`<b>${this.selectedRestaurant.name}</b><br>Origin`);

            // Add destination marker
            this.destinationMarker = L.marker([this.currentDestination.lat, this.currentDestination.lng], {
                icon: this.pinIcon
            }).addTo(this.map).bindPopup(`<b>Destination</b><br>${this.currentDestination.displayName}`);

            // Add vehicle marker at origin
            this.vehicleMarker = L.marker([this.selectedRestaurant.lat, this.selectedRestaurant.lng], {
                icon: this.vehicleIcon
            }).addTo(this.map);

            // Configure animator
            this.animator.setRoute(routeData.geometry, routeData.distanceKm, routeData.durationMins);

        } catch (err) {
            console.error('Route calculation failed:', err);
            alert('Unable to calculate driving route to this address. Please try another location.');
        }
    }

    handleAnimatorTick(data) {
        if (this.vehicleMarker) {
            this.vehicleMarker.setLatLng(data.currentLatLng);

            // Rotate vehicle icon smoothly based on bearing
            const inner = document.getElementById('vehicle-icon-inner');
            if (inner) {
                inner.style.transform = `rotate(${data.bearing}deg)`;
            }
        }

        // Update HUD UI
        document.getElementById('progress-bar').style.width = `${data.progressPct}%`;
        document.getElementById('driver-status-text').innerText = `${data.statusText} (${data.remainingDistanceKm} km left)`;

        // Format remaining seconds into MM:SS
        const mins = Math.floor(data.remainingSec / 60);
        const secs = data.remainingSec % 60;
        document.getElementById('eta-time').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async handleDeliveryComplete() {
        this.updatePlayButtonUI(false);
        document.getElementById('driver-status-text').innerText = '🎉 Delivered! Order has arrived.';
        document.getElementById('eta-time').innerText = '00:00';

        // Persist completed delivery to Supabase database
        if (this.activeRoute && this.currentDestination) {
            await saveDeliveryRecord({
                restaurantName: this.selectedRestaurant.name,
                destinationAddress: this.currentDestination.displayName,
                originLat: this.selectedRestaurant.lat,
                originLng: this.selectedRestaurant.lng,
                destLat: this.currentDestination.lat,
                destLng: this.currentDestination.lng,
                distanceKm: this.activeRoute.distanceKm,
                durationMins: this.activeRoute.durationMins,
                status: 'completed'
            });
        }
    }

    handleStatusChange(status) {
        if (status === 'in_transit') {
            document.getElementById('driver-status-text').innerText = '🛵 Out for delivery...';
        }
    }

    updatePlayButtonUI(isPlaying) {
        const icon = document.getElementById('play-icon');
        const text = document.getElementById('play-text');
        if (isPlaying) {
            icon.innerText = '⏸';
            text.innerText = 'Pause';
        } else {
            icon.innerText = '▶';
            text.innerText = 'Resume';
        }
    }

    async openSavedAddressesDrawer() {
        const drawer = document.getElementById('drawer');
        document.getElementById('drawer-title').innerText = '⭐ Saved Addresses';
        const body = document.getElementById('drawer-body');
        body.innerHTML = '<div style="color:var(--text-muted);">Loading saved addresses from Supabase...</div>';
        drawer.classList.add('open');

        const addresses = await getSavedAddresses();
        body.innerHTML = '';

        if (addresses.length === 0) {
            body.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">No saved addresses yet. Enter an address in search and click ⭐ Save Address!</div>';
            return;
        }

        addresses.forEach(item => {
            const card = document.createElement('div');
            card.className = 'saved-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--accent-coral); font-size:15px;">${item.label}</strong>
                    <button class="btn-delete" style="background:transparent; border:none; color:#ef4444; cursor:pointer;">🗑 Delete</button>
                </div>
                <div class="history-address">${item.address_text}</div>
                <button class="btn-secondary-sm btn-use" style="align-self:flex-start; margin-top:6px;">Deliver Here</button>
            `;

            card.querySelector('.btn-use').addEventListener('click', async () => {
                drawer.classList.remove('open');
                await this.setDestination({
                    displayName: item.address_text,
                    shortName: item.label,
                    lat: item.lat,
                    lng: item.lng
                });
            });

            card.querySelector('.btn-delete').addEventListener('click', async () => {
                await deleteAddress(item.id);
                await this.openSavedAddressesDrawer();
            });

            body.appendChild(card);
        });
    }

    async openHistoryDrawer() {
        const drawer = document.getElementById('drawer');
        document.getElementById('drawer-title').innerText = '📜 Delivery History';
        const body = document.getElementById('drawer-body');
        body.innerHTML = '<div style="color:var(--text-muted);">Loading history logs from Supabase...</div>';
        drawer.classList.add('open');

        const history = await getDeliveryHistory();
        body.innerHTML = '';

        if (history.length === 0) {
            body.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">No completed delivery trips yet. Run a delivery simulation to see history logs!</div>';
            return;
        }

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const dateStr = new Date(item.created_at).toLocaleString();
            card.innerHTML = `
                <div class="history-card-header">
                    <div class="history-restaurant">${item.restaurant_name}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
                <div class="history-address">To: ${item.destination_address}</div>
                <div class="history-meta">
                    <span>📏 ${item.distance_km} km</span>
                    <span>⏱ ${item.duration_mins} mins</span>
                    <span style="color:var(--accent-green);">Status: ${item.status}</span>
                </div>
            `;
            body.appendChild(card);
        });
    }
}

// Start Application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.app = new DeliveryApp();
});
