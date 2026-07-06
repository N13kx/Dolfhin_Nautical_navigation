/**
 * Vessel marker DOM utilities for MapLibre GL.
 *
 * Creates and updates the boat position marker element.
 * The caller owns the MapLibre Marker instance lifecycle.
 */

/** Creates the DOM element for the boat/position marker */
export function createBoatMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'relative flex items-center justify-center w-8 h-8 pointer-events-none';

  // Outer pulsing accuracy ring
  const ring = document.createElement('div');
  ring.className = 'absolute inset-0 rounded-full boat-pulse-ring pointer-events-none';
  ring.style.backgroundColor = 'rgba(68, 228, 194, 0.28)';
  el.appendChild(ring);

  // Inner teal circle
  const circle = document.createElement('div');
  circle.className =
    'relative flex items-center justify-center rounded-full w-6 h-6 shadow-lg pointer-events-none z-10';
  circle.style.backgroundColor = '#44e4c2';
  circle.style.boxShadow = '0 0 10px rgba(68,228,194,0.5)';

  // Heading arrow — CSS triangle pointing up, rotated to true heading
  const arrow = document.createElement('div');
  arrow.dataset.role = 'heading-arrow';
  arrow.style.width = '0';
  arrow.style.height = '0';
  arrow.style.borderLeft = '4px solid transparent';
  arrow.style.borderRight = '4px solid transparent';
  arrow.style.borderBottom = '8px solid #06232b';
  arrow.style.transform = 'translateY(-1px)';
  arrow.style.transition = 'transform 0.4s ease';

  circle.appendChild(arrow);
  el.appendChild(circle);

  return el;
}

/**
 * Updates the heading arrow on an existing marker element.
 * @param el   The root element returned by createBoatMarkerElement()
 * @param heading  True heading in degrees
 */
export function updateBoatHeading(el: HTMLElement, heading: number): void {
  const arrow = el.querySelector<HTMLElement>('[data-role="heading-arrow"]');
  if (arrow) {
    arrow.style.transform = `translateY(-1px) rotate(${heading}deg)`;
  }
}
