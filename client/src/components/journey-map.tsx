// src/components/journey-map.tsx
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Locate } from 'lucide-react';

// Fix Leaflet markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface Dealer {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface JourneyMapProps {
  currentLocation?: Location | null;
  selectedDealer?: Dealer | null;
  routePolyline?: [number, number][];
  className?: string;
}

export interface JourneyMapRef {
  setView: (lat: number, lng: number, zoom?: number) => void;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  getCurrentLocation: () => Promise<Location | null>;
}

const JourneyMap = forwardRef<JourneyMapRef, JourneyMapProps>(({
  currentLocation,
  selectedDealer,
  routePolyline = [],
  className = ""
}, ref) => {
  const mapRef = useRef<any>(null);

  // Expose map methods to parent
  // UPDATE the useImperativeHandle to include getCurrentLocation:
  useImperativeHandle(ref, () => ({
    setView: (lat: number, lng: number, zoom = 13) => {
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], zoom);
      }
    },
    getZoom: () => {
      return mapRef.current ? mapRef.current.getZoom() : 13;
    },
    setZoom: (zoom: number) => {
      if (mapRef.current) {
        mapRef.current.setZoom(zoom);
      }
    },
    // ADD THIS METHOD:
    getCurrentLocation: async (): Promise<Location | null> => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          });
        });

        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current Location'
        };

        if (mapRef.current) {
          mapRef.current.setView([location.lat, location.lng], 15);
        }

        return location;
      } catch (err) {
        console.error('Location error:', err);
        return null;
      }
    }
  }));

  // Enhanced markers
  const userIcon = new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-lg animate-pulse"></div>
        <div class="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: 'user-marker'
  });

  const dealerIcon = new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-6 h-6 bg-red-500 border-3 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transform rotate-45">
          <span class="transform -rotate-45">📍</span>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    className: 'dealer-marker'
  });

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.setZoom(mapRef.current.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.setZoom(mapRef.current.getZoom() - 1);
    }
  };

  const handleLocate = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
    }
  };

  return (
    <Card className={`relative overflow-hidden border-0 shadow-lg ${className}`}>
      {/* Map Container with fixed height */}
      <div className="h-96 w-full relative">
        <MapContainer
          ref={mapRef}
          center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [26.1445, 91.7362]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          className="rounded-lg"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Current Location Marker - ADD NULL CHECKS */}
          {currentLocation &&
            currentLocation.lat !== undefined &&
            currentLocation.lng !== undefined &&
            !isNaN(currentLocation.lat) &&
            !isNaN(currentLocation.lng) && (
              <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userIcon}>
                <Popup>
                  <div className="text-center p-1">
                    <div className="text-blue-600 font-semibold text-sm">📍 Your Location</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

          {/* Destination Marker - ADD NULL CHECKS */}
          {selectedDealer &&
            selectedDealer.latitude !== undefined &&
            selectedDealer.longitude !== undefined &&
            !isNaN(selectedDealer.latitude) &&
            !isNaN(selectedDealer.longitude) && (
              <Marker
                position={[selectedDealer.latitude, selectedDealer.longitude]}
                icon={dealerIcon}
              >
                <Popup>
                  <div className="text-center p-1">
                    <div className="text-red-600 font-semibold text-sm">🏢 {selectedDealer.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{selectedDealer.address}</div>
                  </div>
                </Popup>
              </Marker>
            )}

          {/* Route Polyline */}
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{
                color: '#3B82F6',
                weight: 4,
                opacity: 0.8,
                dashArray: '8, 4'
              }}
            />
          )}
        </MapContainer>

        {/* Map Controls - Inside the map container */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <Button
            onClick={handleZoomIn}
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-full shadow-md bg-white/90 backdrop-blur border-gray-200/50 hover:bg-white"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleZoomOut}
            size="icon"
            variant="secondary"
            className="h-9 w-9 rounded-full shadow-md bg-white/90 backdrop-blur border-gray-200/50 hover:bg-white"
          >
            <Minus className="h-4 w-4" />
          </Button>
          {currentLocation && (
            <Button
              onClick={handleLocate}
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full shadow-md bg-white/90 backdrop-blur border-gray-200/50 hover:bg-white"
            >
              <Locate className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Map Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200/50 px-3 py-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>© OpenStreetMap</span>
          <div className="flex items-center gap-2">
            {currentLocation && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Live
              </span>
            )}
            {selectedDealer && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {selectedDealer.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

JourneyMap.displayName = 'JourneyMap';

export default JourneyMap;