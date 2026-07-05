// A simple utility to create the marker DOM element for MapLibre
export function createBoatMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'relative flex items-center justify-center w-8 h-8 pointer-events-none';
  
  // Outer pulsing ring
  const ring = document.createElement('div');
  ring.className = 'absolute inset-0 rounded-full boat-pulse-ring pointer-events-none';
  ring.style.backgroundColor = 'rgba(68, 228, 194, 0.28)';
  el.appendChild(ring);
  
  // Inner circle
  const circle = document.createElement('div');
  circle.className = 'relative flex items-center justify-center rounded-full w-6 h-6 shadow-lg pointer-events-none z-10';
  circle.style.backgroundColor = '#44e4c2';
  circle.style.boxShadow = '0 0 10px rgba(68,228,194,0.5)';
  
  // Triangle pointing up (heading)
  const triangle = document.createElement('div');
  // Simple CSS triangle
  triangle.style.width = '0';
  triangle.style.height = '0';
  triangle.style.borderLeft = '4px solid transparent';
  triangle.style.borderRight = '4px solid transparent';
  triangle.style.borderBottom = '8px solid #06232b'; // Dark color
  triangle.style.transform = 'translateY(-1px)';
  
  circle.appendChild(triangle);
  el.appendChild(circle);
  
  return el;
}
