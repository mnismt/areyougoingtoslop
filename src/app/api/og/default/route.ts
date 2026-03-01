import { ImageResponse } from 'next/og'
import { renderOgCard } from '../og-card'
import { loadOgFonts } from '../og-fonts'
import {
  createOgImageResponse,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '../og-response'

type DefaultOgRouteOverrides = {
  loadOgFonts?: typeof loadOgFonts
}

const getRouteOverrides = (): Required<DefaultOgRouteOverrides> => {
  const runtime = globalThis as typeof globalThis & {
    __aysDefaultOgRouteOverrides?: DefaultOgRouteOverrides
  }
  return {
    loadOgFonts:
      runtime.__aysDefaultOgRouteOverrides?.loadOgFonts ?? loadOgFonts,
  }
}

export const GET = async () => {
  const overrides = getRouteOverrides()
  const fonts = await overrides.loadOgFonts(
    'areyougoingslop playful slop score',
  )
  const image = new ImageResponse(
    renderOgCard({
      variant: 'unavailable',
      title: 'playful slop score',
      subtitle: 'we scan public github activity and deliver a fun roast.',
      note: 'drop a username at areyougoingslop.com to pull the receipt.',
    }),
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      fonts,
    },
  )

  return createOgImageResponse(image)
}
