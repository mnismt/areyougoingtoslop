export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export const OG_IMAGE_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

// For the "unavailable" card shown while a score is still being computed: the real card
// replaces it within minutes, so CDNs and unfurlers must not hold on to it.
export const OG_IMAGE_PENDING_CACHE_CONTROL = 'public, max-age=60'

export const createOgImageResponse = (
  image: Response,
  cacheControl = OG_IMAGE_CACHE_CONTROL,
) => {
  return new Response(image.body, {
    status: image.status,
    statusText: image.statusText,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': cacheControl,
    },
  })
}
