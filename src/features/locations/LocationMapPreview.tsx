import { Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { useEffect } from 'react'
import {
  LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS,
  LOCATION_TOP_STACK_PANEL_SURFACE_CLASS,
  LOCATION_TOP_STACK_PLACEHOLDER_CLASS,
} from './location-top-stack.styles'

type LocationMapPreviewProps = {
  lat: number | null
  lng: number | null
  disabled?: boolean
  mapEnabled?: boolean
}

type LocationMapCameraSyncProps = {
  position: {
    lat: number
    lng: number
  }
}

function LocationMapCameraSync({ position }: LocationMapCameraSyncProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) {
      return
    }

    map.panTo(position)
    map.setZoom(16)
  }, [map, position])

  return null
}

function LocationMapPreview({
  disabled = false,
  lat,
  lng,
  mapEnabled = true,
}: LocationMapPreviewProps) {
  if (!mapEnabled || lat === null || lng === null) {
    return (
      <div
        className={[
          'mt-4 text-sm text-slate-600',
          LOCATION_TOP_STACK_PLACEHOLDER_CLASS,
        ].join(' ')}
      >
        <div className="flex max-w-[18rem] flex-col items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
          </span>
          <p>Selecciona una direccion para ver la ubicacion en el mapa.</p>
        </div>
      </div>
    )
  }

  const position = { lat, lng }
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`

  return (
    <div className={['mt-4', LOCATION_TOP_STACK_PANEL_SURFACE_CLASS].join(' ')}>
      <div className={['relative w-full', LOCATION_TOP_STACK_PANEL_HEIGHT_CLASS].join(' ')}>
        <Map
          defaultCenter={position}
          defaultZoom={16}
          zoomControl
          clickableIcons={false}
          keyboardShortcuts
          gestureHandling="greedy"
          scrollwheel
          disableDoubleClickZoom={false}
          draggable
          fullscreenControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          className={disabled ? 'h-full w-full opacity-80' : 'h-full w-full'}
        >
          <LocationMapCameraSync position={position} />
          <Marker position={position} draggable={false} />
        </Map>
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute right-3 top-3 z-10">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-white/92 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-white"
            >
              Abrir en Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationMapPreview
