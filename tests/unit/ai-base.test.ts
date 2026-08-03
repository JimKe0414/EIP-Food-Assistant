import { describe, expect, it } from 'vitest'
import { extensionFromMimeType } from '~/server/services/ai/base'

describe('extensionFromMimeType', () => {
  it('maps common browser recording MIME types to their file extension', () => {
    expect(extensionFromMimeType('audio/webm')).toBe('webm')
    expect(extensionFromMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionFromMimeType('audio/mp4')).toBe('mp4')
    expect(extensionFromMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('mp4')
    expect(extensionFromMimeType('audio/ogg;codecs=opus')).toBe('ogg')
    expect(extensionFromMimeType('audio/wav')).toBe('wav')
    expect(extensionFromMimeType('audio/mpeg')).toBe('mp3')
  })

  it('falls back to webm for an unrecognized subtype', () => {
    expect(extensionFromMimeType('audio/x-unknown-codec')).toBe('webm')
  })
})
