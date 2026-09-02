# Serverless Food Delivery Simulator (cchoice)

A lightweight, serverless single-page application (SPA) that simulates a food delivery tracking interface. Users can input an arbitrary street address to trigger a live animated delivery driver moving along real street networks toward their location within a maximum 20-minute drive time.

---

## Key Features

* **Arbitrary Address Geocoding:** Converts typed address strings into latitude/longitude coordinates via the OpenStreetMap Nominatim API.
* **Realistic Route Calculation:** Queries the public OSRM (Open Source Routing Machine) API to fetch driving geometries constrained to a 20-minute duration limit.
* **Interactive Map & Driver Animation:** Renders lightweight map tiles using Leaflet.js and animates the driver along polyline waypoints using Turf.js spatial interpolation.
* **Backend Profile Persistence:** Integrates with Supabase via client-side JavaScript to store user profile data, saved addresses, and delivery history under Row Level Security (RLS).
* **Static Hosting:** Runs 100% in the browser with zero custom server infrastructure or monthly hosting costs.

---

## Tech Stack

* **Frontend UI:** HTML5, CSS3, JavaScript (ES6 Modules)
* **Mapping & Geometry:** Leaflet.js, Turf.js, OpenStreetMap raster tiles
* **External Web APIs:** Nominatim Geocoding API, OSRM Routing Engine API
* **Backend-as-a-Service:** Supabase (PostgreSQL, Auth, RLS Policies)
* **Deployment / Hosting:** GitHub Pages

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Browser (GitHub Pages)               │
│                                                             │
│   ┌──────────────────┐   ┌──────────────────────────────┐   │
│   │    Vanilla UI    │   │      Leaflet & Turf.js       │   │
│   └────────┬─────────┘   └──────────────┬───────────────┘   │
└────────────┼────────────────────────────┼───────────────────┘
             │                            │
             │ HTTPS (Client SDK)         │ Fetch Requests
             ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  Supabase (Cloud BaaS)   │  │   OpenStreetMap & OSRM API   │
│  - User Authentication   │  │   - Address Geocoding        │
│  - Profiles (PostgreSQL) │  │   - Driving Route Geometry   │
└──────────────────────────┘  └──────────────────────────────┘
```

---

## Setup & Local Development

1. Open `index.html` in a web browser or use a local static server:
   ```bash
   npx serve .
   ```
2. Database schema and migrations are located in `supabase/migrations/01_schema.sql`.

---

## GitHub Pages Deployment Checklist

1. **Repository Setup:** Push `index.html` and static JS/CSS assets to the `main` branch.
2. **Pages Configuration:** Enable GitHub Pages via **Settings > Pages > Source: Deploy from branch (main)**.
3. **Environment Security:** Ensure only the **Supabase Anon Key** is embedded in client code and RLS is enabled on all PostgreSQL tables.
