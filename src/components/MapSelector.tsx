import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { Yagna, LatLng } from '../types';
import { Search, Loader2, MapPin, Layers } from 'lucide-react';

// Fix for default marker icon in leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapEvents({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 18);
  }, [center, map]);
  return null;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function MapSelector({ yagna }: { yagna: Yagna }) {
  const updateYagna = useStore(state => state.updateYagna);
  const position = yagna.location || { lat: 28.6139, lng: 77.2090 };
  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>(yagna.polygon || []);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleMapClick = (latlng: LatLng) => {
    const newPoints = [...polygonPoints, { lat: latlng.lat, lng: latlng.lng }];
    setPolygonPoints(newPoints);
    
    // Update location to center of first click if not set, or just use the first point
    const newLocation = newPoints.length === 1 ? newPoints[0] : position;
    
    updateYagna(yagna.id, { 
      location: newLocation,
      polygon: newPoints
    });

    if (newPoints.length >= 3) {
      // Calculate bounding box distances
      let minLat = newPoints[0].lat, maxLat = newPoints[0].lat;
      let minLng = newPoints[0].lng, maxLng = newPoints[0].lng;
      
      for (const p of newPoints) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
      
      const p1 = L.latLng(minLat, minLng);
      const p2 = L.latLng(minLat, maxLng);
      const p3 = L.latLng(maxLat, minLng);
      
      const width = p1.distanceTo(p2);
      const height = p1.distanceTo(p3);
      
      updateYagna(yagna.id, { 
        dimensions: { 
          width: Math.round(width), 
          height: Math.round(height) 
        } 
      });
    }
  };

  const handleClear = () => {
    setPolygonPoints([]);
    updateYagna(yagna.id, { polygon: [] });
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en',
          }
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const data = await response.json();
      setSearchResults(data);
      if (data.length === 0) {
        setSearchError('No locations found. Try a different search term.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchError('Error searching for location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const newLocation = { lat, lng };

    updateYagna(yagna.id, {
      location: newLocation,
    });

    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search city, venue or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900 text-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <span>Search</span>
          )}
        </button>

        {/* Suggestions dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => selectResult(result)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-xs flex items-start gap-2 text-slate-700"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {searchError && (
        <p className="text-xs text-red-500 font-medium">{searchError}</p>
      )}

      {/* Map Container */}
      <div className="w-full h-80 bg-slate-200 rounded-lg overflow-hidden relative z-0">
        {/* Map Type Switcher Overlay */}
        <div className="absolute top-2 right-2 z-[1000] flex bg-white/90 backdrop-blur-sm shadow-md border border-slate-200 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${mapType === 'street' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${mapType === 'satellite' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Satellite
          </button>
        </div>

        <MapContainer center={position} zoom={18} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          {mapType === 'street' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={22}
              maxNativeZoom={19}
            />
          ) : (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={22}
              maxNativeZoom={19}
            />
          )}
          <MapEvents onMapClick={handleMapClick} />
          <ChangeView center={position} />
          {polygonPoints.length > 0 && (
            <Polygon positions={polygonPoints} color="orange" fillColor="#fcd34d" fillOpacity={0.4} />
          )}
          {polygonPoints.map((p, i) => (
            <Marker key={i} position={p} />
          ))}
        </MapContainer>
      </div>

      <div className="flex justify-between items-center text-sm text-slate-500">
        <span>Click on the map to define the Yagna area polygon.</span>
        {polygonPoints.length > 0 && (
          <button 
            onClick={handleClear}
            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors"
          >
            Clear Polygon
          </button>
        )}
      </div>
    </div>
  );
}
