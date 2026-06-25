import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  route?: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } };
  height?: string;
  className?: string;
}

const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 };

const MARKER_COLORS: Record<string, string> = {
  green: '#22c55e',
  red: '#ef4444',
  gray: '#9ca3af',
  orange: '#f97316',
  blue: '#3b82f6',
};

function isGoogleMapsLoaded(): boolean {
  return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
}

export function MapView({
  center,
  zoom = 12,
  markers = [],
  route,
  height = '300px',
  className,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const directionsRendererRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(isGoogleMapsLoaded());

  // Poll for google.maps availability (it loads async)
  useEffect(() => {
    if (loaded) return;
    const interval = setInterval(() => {
      if (isGoogleMapsLoaded()) {
        setLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    // Give up after 15s
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [loaded]);

  // Initialize the map
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const mapCenter = center || LAGOS_CENTER;
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update center and zoom
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const mapCenter = center || LAGOS_CENTER;
    mapInstanceRef.current.setCenter(mapCenter);
    mapInstanceRef.current.setZoom(zoom);
  }, [center?.lat, center?.lng, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markers.forEach((m) => {
      const colorHex = m.color ? (MARKER_COLORS[m.color] || m.color) : MARKER_COLORS.orange;
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapInstanceRef.current,
        title: m.label || '',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: colorHex,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8,
        },
        label: m.label
          ? {
              text: m.label.length > 12 ? m.label.slice(0, 12) + '...' : m.label,
              color: '#1f2937',
              fontSize: '11px',
              fontWeight: 'bold',
              className: 'map-marker-label',
            }
          : undefined,
      });
      markersRef.current.push(marker);
    });

    // Fit bounds if multiple markers
    if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
    }
  }, [markers, loaded]);

  // Draw route
  useEffect(() => {
    if (!mapInstanceRef.current || !loaded) return;

    // Clear existing renderer
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    if (!route) return;

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#F97316',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });
    directionsRendererRef.current = directionsRenderer;

    directionsService.route(
      {
        origin: route.origin,
        destination: route.destination,
        travelMode: google.maps.TravelMode?.DRIVING || 'DRIVING',
      },
      (result: any, status: string) => {
        if (status === 'OK' || status === google.maps.DirectionsStatus?.OK) {
          directionsRenderer.setDirections(result);
        }
      },
    );
  }, [route?.origin?.lat, route?.origin?.lng, route?.destination?.lat, route?.destination?.lng, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/50 rounded-lg border border-border text-muted-foreground text-sm',
          className,
        )}
        style={{ height }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={cn('rounded-lg border border-border overflow-hidden', className)}
      style={{ height, minHeight: '200px' }}
    />
  );
}
