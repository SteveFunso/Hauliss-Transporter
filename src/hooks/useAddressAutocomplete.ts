import { useEffect, useRef } from 'react';

type PlaceResult = {
  address: string;
  lat: number;
  lng: number;
};

function isGoogleMapsLoaded(): boolean {
  return (
    typeof google !== 'undefined' &&
    typeof google.maps !== 'undefined' &&
    typeof google.maps.places !== 'undefined'
  );
}

export function useAddressAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | null>,
  onSelect: (place: PlaceResult) => void,
) {
  const autocompleteRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    // Try to attach autocomplete - handles both Google Maps not loaded AND input not mounted
    const tryAttach = () => {
      if (!isGoogleMapsLoaded() || !inputRef.current) return false;
      if (autocompleteRef.current) return true; // already attached

      try {
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'ng' },
          fields: ['formatted_address', 'geometry'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry?.location) {
            onSelectRef.current({
              address: place.formatted_address || '',
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });

        autocompleteRef.current = autocomplete;
        return true;
      } catch (e) {
        console.warn('Failed to attach autocomplete:', e);
        return false;
      }
    };

    if (tryAttach()) return;

    // Poll until BOTH google maps is loaded AND the input ref is available
    const interval = setInterval(() => {
      if (tryAttach()) clearInterval(interval);
    }, 500);

    const timeout = setTimeout(() => clearInterval(interval), 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [inputRef]);
}
