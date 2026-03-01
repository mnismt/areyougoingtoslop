export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export const OG_IMAGE_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

export const createOgImageResponse = (image: Response) => {
  return new Response(image.body, {
    status: image.status,
    statusText: image.statusText,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': OG_IMAGE_CACHE_CONTROL,
    },
  })
}
