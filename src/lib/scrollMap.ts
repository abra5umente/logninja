// Browsers cap how tall an element can be (about 33.5 million px in Chrome and Safari, 17.9 million in
// Firefox). At 28px a row that is about 1.2 million rows, and the rows past it could not be scrolled to.
// When the rows are taller than the cap, the scroll range is made as tall as allowed and a scroll
// position in it stands for a proportional position in the rows.

export interface ScrollMap {
  /** Height to give the scrolling element's content */
  spacer: number
  /** Scroll position in the scrolling element -> position in the rows */
  toVirtual(top: number): number
  /** Position in the rows -> scroll position in the scrolling element */
  toPhysical(top: number): number
}

const same = (t: number) => t

/**
 * total: full height of the rows; maxSpacer: tallest the browser allows; viewH: visible height of the
 * scrolling element. Scaled so that scrolled to the very bottom shows the last row.
 */
export function scrollMap(total: number, maxSpacer: number, viewH: number): ScrollMap {
  if (total <= maxSpacer || maxSpacer <= viewH) return { spacer: total, toVirtual: same, toPhysical: same }
  const ratio = (total - viewH) / (maxSpacer - viewH)
  return { spacer: maxSpacer, toVirtual: t => t * ratio, toPhysical: t => t / ratio }
}
