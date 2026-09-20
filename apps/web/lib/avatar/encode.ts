import sharp from 'sharp'

const AVATAR_SIZE = 512
const JPEG_QUALITY = 85

/** Re-encode any supported image to a 512×512 JPEG for LDAP jpegPhoto. */
export async function encodeAvatarJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}
