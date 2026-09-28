import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Greater Baton Rouge - the only area loaded into the directory so far.
export const DEFAULT_CENTER = { lat: 30.44, lon: -91.13 };
const DEFAULT_ZOOM = 12;

// Leaflet paints SVG paths from options, so these mirror theme.css tokens.
const PIN = { color: "#ffffff", fillColor: "#087c80", weight: 2, fillOpacity: 1 };
// Before a search the map is dotted with many businesses: small, quiet dots,
// with the ones five* rates standing out.
const DOT = { color: "#ffffff", fillColor: "#087c80", weight: 1, fillOpacity: 0.75 };
const DOT_RATED = { color: "#ffffff", fillColor: "#173c45", weight: 2, fillOpacity: 1 };
const PIN_ACTIVE = { color: "#ffffff", fillColor: "#173c45", weight: 3, fillOpacity: 1 };
const YOU = { color: "#ffffff", fillColor: "#2f7de1", weight: 3, fillOpacity: 1 };
const YOU_HALO = { stroke: false, fillColor: "#2f7de1", fillOpacity: 0.15 };

export function mapView(map) {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    center: { lat: center.lat, lon: center.lng },
    bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
  };
}

function MapController({
  places,
  userLocation,
  fitKey,
  focus,
  resizeKey,
  onReady,
  onUserMove,
  onBackgroundClick,
  programmaticMove,
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map]);

  // Re-measure the map after its box changes, without the resulting pan counting as
  // someone moving the map.
  function measureQuietly() {
    programmaticMove.current = true;
    map.invalidateSize();
    programmaticMove.current = false;
  }

  // The page changed the map's box (a view switch, leaving the intro).
  useEffect(() => {
    if (resizeKey) measureQuietly();
  }, [resizeKey]);

  // Frame a fresh set of results; an area search keeps the map where the user put it.
  useEffect(() => {
    if (!fitKey) return;
    // The mobile map may have just been un-hidden; Leaflet needs its real size first.
    measureQuietly();
    const points = places.filter((p) => p.lat != null && p.lon != null).map((p) => [p.lat, p.lon]);
    if (userLocation) points.push([userLocation.lat, userLocation.lon]);
    if (points.length === 0) return;
    programmaticMove.current = true;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15));
    } else {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
    }
  }, [fitKey]);

  // Zoom to a spot (e.g. "near me") without fitting it to the results.
  useEffect(() => {
    if (!focus) return;
    measureQuietly();
    programmaticMove.current = true;
    map.setView([focus.lat, focus.lon], focus.zoom);
  }, [focus]);

  // Leaflet's own resize tracking (switched off below) re-fits the map on every window
  // resize - on phones, every time the toolbars slide in or out mid-scroll - and its pan
  // reads as someone moving the map, which reloads the pins. Re-fit only while the map is
  // on screen and its box really changed, and quietly.
  useEffect(() => {
    const box = map.getContainer();
    let onScreen = false;
    let timer = 0;
    function refit() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const size = map.getSize();
        if (!onScreen || (box.clientWidth === size.x && box.clientHeight === size.y)) return;
        measureQuietly();
      }, 150);
    }
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      refit();
    });
    observer.observe(box);
    window.addEventListener("resize", refit);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", refit);
    };
  }, [map]);

  useMapEvents({
    click() {
      onBackgroundClick?.();
    },
    moveend() {
      if (programmaticMove.current) {
        programmaticMove.current = false;
        return;
      }
      onUserMove(mapView(map));
    },
  });

  return null;
}

export default function SearchMap({
  places,
  userLocation,
  activeId,
  fitKey,
  focus,
  resizeKey,
  showTooltips = true,
  compact = false,
  onHover,
  onSelect,
  onReady,
  onUserMove,
  onBackgroundClick,
}) {
  const programmaticMove = useRef(false);

  return (
    <MapContainer
      className="search-map"
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lon]}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      trackResize={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapController
        places={places}
        userLocation={userLocation}
        fitKey={fitKey}
        focus={focus}
        resizeKey={resizeKey}
        onReady={onReady}
        onUserMove={onUserMove}
        onBackgroundClick={onBackgroundClick}
        programmaticMove={programmaticMove}
      />
      {userLocation && (
        <>
          <CircleMarker center={[userLocation.lat, userLocation.lon]} radius={22} pathOptions={YOU_HALO} interactive={false} />
          <CircleMarker center={[userLocation.lat, userLocation.lon]} radius={7} pathOptions={YOU}>
            <Tooltip direction="top" offset={[0, -8]}>You are here</Tooltip>
          </CircleMarker>
        </>
      )}
      {places
        .filter((place) => place.lat != null && place.lon != null)
        .map((place) => {
          const active = place.id === activeId;
          const rated = place.five_star_status > 0;
          const style = active ? PIN_ACTIVE : !compact ? PIN : rated ? DOT_RATED : DOT;
          return (
            <CircleMarker
              key={place.id}
              center={[place.lat, place.lon]}
              radius={active ? 11 : compact ? (rated ? 7 : 5) : 8}
              pathOptions={style}
              bubblingMouseEvents={false}
              eventHandlers={{
                mouseover: () => onHover(place.id),
                mouseout: () => onHover(null),
                click: () => onSelect(place),
              }}
            >
              {showTooltips && (
                <Tooltip direction="top" offset={[0, -8]}>
                  <strong>{place.name}</strong>
                  {place.street && <><br />{place.street}</>}
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
