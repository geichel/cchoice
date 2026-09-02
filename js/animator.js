// Turf.js Route Animation & Trajectory Engine
import * as turf from 'https://cdn.jsdelivr.net/npm/@turf/turf@7/+esm';

export class DeliveryAnimator {
    constructor(options = {}) {
        this.routeGeoJson = null;
        this.totalDistanceKm = 0;
        this.simulatedDurationSec = 60; // default total trip time in seconds for demo
        this.speedMultiplier = 1;
        this.isPlaying = false;
        this.currentProgressSec = 0;
        this.lastTimestamp = null;
        this.animFrameId = null;

        this.onTick = options.onTick || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
    }

    setRoute(geojsonLineString, totalDistanceKm, durationMins) {
        this.stop();
        
        // Convert to Turf Feature LineString if raw geometry
        if (geojsonLineString.type === 'LineString') {
            this.routeGeoJson = turf.lineString(geojsonLineString.coordinates);
        } else {
            this.routeGeoJson = geojsonLineString;
        }

        this.totalDistanceKm = turf.length(this.routeGeoJson, { units: 'kilometers' });
        
        // Scale simulated delivery time: 
        // e.g. a 15-minute real drive defaults to 45 seconds of real-time simulation at 1x speed
        this.simulatedDurationSec = Math.max(15, Math.min(120, durationMins * 4));
        this.currentProgressSec = 0;
        this.lastTimestamp = null;

        this.updateState();
    }

    start() {
        if (!this.routeGeoJson) return;
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastTimestamp = performance.now();
        this.onStatusChange('in_transit');
        this.tick(this.lastTimestamp);
    }

    pause() {
        this.isPlaying = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    stop() {
        this.pause();
        this.currentProgressSec = 0;
        this.lastTimestamp = null;
    }

    setSpeed(multiplier) {
        this.speedMultiplier = Math.max(1, Math.min(20, multiplier));
    }

    tick(now) {
        if (!this.isPlaying) return;

        const deltaMs = now - this.lastTimestamp;
        this.lastTimestamp = now;

        // Advance simulation clock based on delta and speed multiplier
        this.currentProgressSec += (deltaMs / 1000) * this.speedMultiplier;

        if (this.currentProgressSec >= this.simulatedDurationSec) {
            this.currentProgressSec = this.simulatedDurationSec;
            this.updateState();
            this.pause();
            this.onStatusChange('delivered');
            this.onComplete();
            return;
        }

        this.updateState();
        this.animFrameId = requestAnimationFrame((timestamp) => this.tick(timestamp));
    }

    updateState() {
        if (!this.routeGeoJson || this.totalDistanceKm === 0) return;

        const progressFraction = Math.min(1, Math.max(0, this.currentProgressSec / this.simulatedDurationSec));
        const currentDistanceKm = progressFraction * this.totalDistanceKm;

        // Calculate point along polyline using Turf
        const currentPoint = turf.along(this.routeGeoJson, currentDistanceKm, { units: 'kilometers' });
        const [lng, lat] = currentPoint.geometry.coordinates;

        // Calculate bearing/heading angle for smooth vehicle rotation
        let bearing = 0;
        const nextDistKm = Math.min(this.totalDistanceKm, currentDistanceKm + 0.02);
        if (nextDistKm > currentDistanceKm) {
            const nextPoint = turf.along(this.routeGeoJson, nextDistKm, { units: 'kilometers' });
            bearing = turf.bearing(currentPoint, nextPoint);
        }

        const remainingKm = Math.max(0, this.totalDistanceKm - currentDistanceKm);
        const remainingSec = Math.max(0, (1 - progressFraction) * this.simulatedDurationSec);

        // Derive delivery status step
        let statusText = 'En Route';
        if (progressFraction < 0.05) statusText = 'Driver Picked Up Order';
        else if (progressFraction < 0.85) statusText = 'Driving to Destination';
        else if (progressFraction < 0.98) statusText = 'Approaching Location';
        else statusText = 'Arriving Now!';

        this.onTick({
            currentLatLng: [lat, lng],
            bearing: bearing,
            progressPct: Math.round(progressFraction * 100),
            remainingSec: Math.round(remainingSec),
            remainingDistanceKm: Math.round(remainingKm * 10) / 10,
            statusText: statusText
        });
    }
}
