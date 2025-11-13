/**
 * FLUX: Format for LLM Understanding and eXchange
 * Main entry point
 */

export { encode, EncodeOptions, TypeMarkers } from './flux-encoder'
export { decode, DecodeOptions } from './flux-decoder'

// Version
export const VERSION = '1.0.0'

// Re-export everything for convenience
import { encode } from './flux-encoder'
import { decode } from './flux-decoder'

export default {
  encode,
  decode,
  VERSION
}
