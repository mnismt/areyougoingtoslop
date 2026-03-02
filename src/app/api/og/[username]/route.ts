import { ImageResponse } from 'next/og'
import {
  getCachedOgImage,
  setCachedOgImage,
} from '../../../../server/cache/og-image-cache'
import { renderOgCard } from '../og-card'
import { type ResolveOgDataResult, resolveOgData } from '../og-data'
import { loadOgFonts } from '../og-fonts'
import {
  createOgImageResponse,
  OG_IMAGE_CACHE_CONTROL,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from '../og-response'

const OG_IMAGE_TTL_MS = 12 * 60 * 60 * 1000

type Params = {
  params: Promise<{ username: string }>
}

type OgRouteOverrides = {
  resolveOgData?: typeof resolveOgData
  loadOgFonts?: typeof loadOgFonts
  getCachedOgImage?: typeof getCachedOgImage
  setCachedOgImage?: typeof setCachedOgImage
}

const getRouteOverrides = (): Required<OgRouteOverrides> => {
  const runtime = globalThis as typeof globalThis & {
    __aysOgRouteOverrides?: OgRouteOverrides
  }

  return {
    resolveOgData:
      runtime.__aysOgRouteOverrides?.resolveOgData ?? resolveOgData,
    loadOgFonts: runtime.__aysOgRouteOverrides?.loadOgFonts ?? loadOgFonts,
    getCachedOgImage:
      runtime.__aysOgRouteOverrides?.getCachedOgImage ?? getCachedOgImage,
    setCachedOgImage:
      runtime.__aysOgRouteOverrides?.setCachedOgImage ?? setCachedOgImage,
  }
}

const toUnavailableFallback = (username: string): ResolveOgDataResult => ({
  source: 'fallback',
  viewModel: {
    variant: 'unavailable',
    username,
    avatarDataUri: null,
    title: 'the vibes are unclear',
    subtitle: 'score unavailable right now. the detector needs a minute.',
  },
})

export const GET = async (_request: Request, { params }: Params) => {
  const { username } = await params
  const overrides = getRouteOverrides()

  const cachedPng = overrides.getCachedOgImage(username)
  if (cachedPng) {
    return new Response(cachedPng, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': OG_IMAGE_CACHE_CONTROL,
      },
    })
  }

  let resolved: ResolveOgDataResult
  try {
    resolved = await overrides.resolveOgData(username)
  } catch (error) {
    console.error('failed to resolve og data', { username, error })
    resolved = toUnavailableFallback(username)
  }

  console.info('og_card', {
    username,
    source: resolved.source,
    variant: resolved.viewModel.variant,
  })

  const fonts = await overrides.loadOgFonts(
    `areyougoingtoslop@${username}${resolved.viewModel.variant}`,
  )
  const image = new ImageResponse(renderOgCard(resolved.viewModel), {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  })

  if (resolved.viewModel.variant === 'result') {
    const png = await image.arrayBuffer()
    overrides.setCachedOgImage(username, png, OG_IMAGE_TTL_MS)
    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': OG_IMAGE_CACHE_CONTROL,
      },
    })
  }

  return createOgImageResponse(image)
}
