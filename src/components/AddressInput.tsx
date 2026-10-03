import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { autocompletePlaces, placeDetails, type PlacePrediction } from '@/lib/api/places';

export type AddressSelection = {
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  state: string | null;
  area: string | null;
  city: string | null;
};

interface AddressInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'onSelect'> {
  value: string;
  /** Fires on every keystroke (the field is fully controlled). */
  onChange: (value: string) => void;
  /** Fires once a suggestion has been resolved to coordinates. */
  onSelect: (place: AddressSelection) => void;
  /** Minimum characters before suggestions are requested (server minimum is 2). */
  minChars?: number;
}

const DEBOUNCE_MS = 300;

const newSessionToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Non-secure contexts (plain http on a LAN) have no randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/**
 * Address typeahead backed by the server-side Places proxy (Nigeria-only).
 * The suggestion list renders inline (not portaled) so it works inside
 * dialogs, and a fresh session token is used per focus session.
 */
export function AddressInput({
  value,
  onChange,
  onSelect,
  minChars = 2,
  className,
  onFocus,
  onBlur,
  onKeyDown,
  id,
  ...inputProps
}: AddressInputProps) {
  const generatedId = useId();
  const inputId = id ?? `address-${generatedId}`;
  const listId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const ensureSession = () => {
    if (!sessionRef.current) sessionRef.current = newSessionToken();
    return sessionRef.current;
  };

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    setQuery(null);
    requestSeq.current += 1; // drop any in-flight response
    setLoading(false);
  }, []);

  const term = (query ?? '').trim();
  const showPanel = open && term.length >= minChars;
  const listOpen = showPanel && suggestions.length > 0;

  // Debounced suggestion fetch — only runs for text the user typed (query is
  // set from onChange, never from the controlled `value` prop, so a parent
  // pre-filling the field for an edit form does not trigger a lookup).
  useEffect(() => {
    if (query === null) return;
    const typed = query.trim();
    if (typed.length < minChars) return;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await autocompletePlaces(typed, ensureSession());
        if (seq !== requestSeq.current) return;
        setSuggestions(results);
        setActiveIndex(results.length ? 0 : -1);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setSuggestions([]);
        setError(errorMessage(err, 'Address search is unavailable right now'));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, minChars]);

  // Escape closes the list. Radix dialogs listen for Escape on the document in
  // the capture phase, so a window-level capture listener (which runs first)
  // marks the event handled before the dialog can dismiss itself.
  useEffect(() => {
    if (!showPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.target !== inputRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      closeList();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [showPanel, closeList]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    setQuery(next);
    setOpen(true);
    setError(null);
    if (next.trim().length < minChars) {
      setSuggestions([]);
      setLoading(false);
    }
  };

  const selectPrediction = async (prediction: PlacePrediction) => {
    const session = ensureSession();
    closeList();
    onChange(prediction.description);
    setResolving(true);
    try {
      const place = await placeDetails(prediction.place_id, session);
      const address = place.address || prediction.description;
      onChange(address);
      onSelectRef.current({
        address,
        lat: place.lat,
        lng: place.lng,
        placeId: place.place_id,
        state: place.state,
        area: place.area,
        city: place.city,
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not resolve that address'));
    } finally {
      setResolving(false);
      // A details call ends the billing session; the next keystroke starts a new one.
      sessionRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    switch (e.key) {
      case 'ArrowDown':
        if (!listOpen) {
          if (suggestions.length) setOpen(true);
          return;
        }
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        if (!listOpen) return;
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case 'Enter':
        if (!listOpen) return;
        e.preventDefault();
        void selectPrediction(suggestions[activeIndex >= 0 ? activeIndex : 0]);
        break;
      case 'Tab':
        if (open) closeList();
        break;
      default:
        break;
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(e);
    ensureSession();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
    closeList();
    sessionRef.current = null;
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          {...inputProps}
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={listOpen && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          aria-busy={resolving || undefined}
          value={value}
          // readOnly (not disabled) keeps focus in the field while the chosen
          // suggestion is resolved to coordinates.
          readOnly={resolving}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-9 pr-9"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showPanel && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          // Keep focus in the input so a click on an option is not preceded by blur.
          onMouseDown={(e) => e.preventDefault()}
        >
          {listOpen ? (
            <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
              {suggestions.map((s, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={s.place_id}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex items-start gap-2 px-3 py-2 text-sm cursor-pointer',
                      active ? 'bg-[#F97316]/10 text-foreground' : 'hover:bg-muted/60'
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void selectPrediction(s)}
                  >
                    <MapPin className={cn('w-4 h-4 mt-0.5 shrink-0', active ? 'text-[#F97316]' : 'text-muted-foreground')} />
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{s.main_text || s.description}</span>
                      {s.secondary_text && (
                        <span className="block text-xs text-muted-foreground truncate">{s.secondary_text}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching addresses…
            </div>
          ) : error ? (
            <div className="px-3 py-3 text-sm text-red-600">{error}</div>
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">No matches in Nigeria</div>
          )}
        </div>
      )}

      {!showPanel && error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
