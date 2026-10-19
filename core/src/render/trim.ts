// The CPU samples u*(extent-1). A retained texel contributes up to one
// source texel beyond the trim, intersected with the author's UV domain.
export function trimStart(offset: number, extent: number): number {
  return extent === 1 ? 0 : Math.max(0, (offset - 1) / (extent - 1));
}
export function trimEnd(offset: number, size: number, extent: number): number {
  return extent === 1 ? 1 : Math.min(1, (offset + size) / (extent - 1));
}
