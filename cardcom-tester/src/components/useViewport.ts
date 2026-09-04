import { useEffect, useState } from 'react'

export type ViewportDevice = 'mobile' | 'tablet' | 'desktop'
export type ViewportOrientation = 'portrait' | 'landscape'

export type Viewport = {
  width: number
  height: number
  device: ViewportDevice
  orientation: ViewportOrientation
}

function read(): Viewport {
  const width = window.innerWidth
  const height = window.innerHeight
  return {
    width,
    height,
    device: width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop',
    orientation: width >= height ? 'landscape' : 'portrait',
  }
}

// Known from the very first render (initialState reads the real window), and
// kept current on resize/rotation -- so any component can size itself for
// mobile/tablet/desktop and portrait/landscape without guessing.
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(read)
  useEffect(() => {
    const update = () => setViewport(read())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return viewport
}
