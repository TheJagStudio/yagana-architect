import { Yagna, Kund } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { polygonContains } from 'd3-polygon';

export function getPolygonCanvasPoints(yagna: Yagna, pxPerMeter: number = 50): { raw: [number, number][], flat: number[], bounds: { minX: number, maxX: number, minY: number, maxY: number } } | null {
  if (!yagna.polygon || yagna.polygon.length < 3) return null;

  const refLat = yagna.polygon[0].lat;
  const refLng = yagna.polygon[0].lng;
  
  const rawPoints: {x: number, y: number}[] = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  yagna.polygon.forEach(p => {
    // Approximate flat earth projection for small areas
    const xMeters = (p.lng - refLng) * 111320 * Math.cos(refLat * Math.PI / 180);
    const yMeters = (p.lat - refLat) * 110574; // Latitude is roughly 110.574 km per degree
    
    const x = xMeters * pxPerMeter;
    const y = -yMeters * pxPerMeter; // Invert Y axis

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    rawPoints.push({ x, y });
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const flat: number[] = [];
  const raw: [number, number][] = [];
  let nMinX = Infinity, nMaxX = -Infinity;
  let nMinY = Infinity, nMaxY = -Infinity;

  rawPoints.forEach(p => {
    const px = p.x - centerX;
    const py = p.y - centerY;
    flat.push(px, py);
    raw.push([px, py]);
    
    if (px < nMinX) nMinX = px;
    if (px > nMaxX) nMaxX = px;
    if (py < nMinY) nMinY = py;
    if (py > nMaxY) nMaxY = py;
  });

  return { flat, raw, bounds: { minX: nMinX, maxX: nMaxX, minY: nMinY, maxY: nMaxY } };
}

function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToPolygonBoundary(p: [number, number], polygon: [number, number][]): number {
  let minDistance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    const dist = distanceToSegment(p[0], p[1], p1[0], p1[1], p2[0], p2[1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

export function generateAutoLayout(
  yagna: Yagna,
  pxPerMeter: number = 50
): Kund[] {
  const layoutType = yagna.settings.layoutType || 'grid';
  const count = yagna.settings.targetKundCount;
  const kundSize = yagna.settings.kundSize;
  const mainKundSize = yagna.settings.mainKundSize || kundSize * 1.5;
  const seatOffset = yagna.settings.seatOffset !== undefined ? yagna.settings.seatOffset : 0.3;
  const seatWidth = yagna.settings.seatWidth || 0.4;
  const seatHeight = yagna.settings.seatHeight || 0.4;
  const maxSeatDim = Math.max(seatWidth, seatHeight);

  // Total footprint size in meters, including seats on both sides
  const stdFootprintSize = kundSize + 2 * (seatOffset + maxSeatDim);
  const mainFootprintSize = mainKundSize + 2 * (seatOffset + maxSeatDim);
  const kSize = stdFootprintSize * pxPerMeter;
  const mainKSize = mainFootprintSize * pxPerMeter;
  const padding = yagna.settings.padding * pxPerMeter;
  const direction = yagna.settings.kundDirection || 0;
  const kunds: Kund[] = [];

  const polyData = getPolygonCanvasPoints(yagna, pxPerMeter);
  const objects = yagna.objects || [];
  
  // Helper to check if a point intersects any object
  const intersectsObject = (x: number, y: number, isMain: boolean = false) => {
    const halfK = (isMain ? mainKSize : kSize) / 2;
    for (const obj of objects) {
      if (obj.points && obj.points.length >= 6) {
         // Treat as polygon
         const rawPoints: [number, number][] = [];
         for (let i = 0; i < obj.points.length; i += 2) {
           rawPoints.push([obj.points[i] + obj.x, obj.points[i+1] + obj.y]);
         }
         if (polygonContains(rawPoints, [x, y])) return true;
      } else {
         const angle = -obj.rotation * Math.PI / 180;
         const dx = x - obj.x;
         const dy = y - obj.y;
         const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
         const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
         
         if (rx >= -halfK && rx <= obj.width + halfK && ry >= -halfK && ry <= obj.height + halfK) {
           return true;
         }
      }
    }
    return false;
  };

  const thetaRad = (direction * Math.PI) / 180;
  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);

  // Rotate a point from canvas space to rotated grid space (rotated by -direction)
  const toGridSpace = (x: number, y: number): [number, number] => {
    return [
      x * cosTheta + y * sinTheta,
      -x * sinTheta + y * cosTheta
    ];
  };

  // Rotate a point from grid space back to canvas space (rotated by direction)
  const toCanvasSpace = (gx: number, gy: number): [number, number] => {
    return [
      gx * cosTheta - gy * sinTheta,
      gx * sinTheta + gy * cosTheta
    ];
  };

  const isValidPlacement = (cx: number, cy: number, isMain: boolean = false) => {
    const size = isMain ? mainKSize : kSize;
    if (polyData) {
      const { raw } = polyData;
      const isInside = polygonContains(raw, [cx, cy]);
      const cPadding = (yagna.settings.canvasPadding || 0) * pxPerMeter;
      const meetsPadding = isInside && (cPadding === 0 || distanceToPolygonBoundary([cx, cy], raw) >= (cPadding + size / 2));
      if (!meetsPadding) return false;
    }
    return !intersectsObject(cx, cy, isMain);
  };

  if (layoutType === 'circular') {
    let num = 1;
    let centerX = 0;
    let centerY = 0;
    
    if (polyData) {
      const { bounds } = polyData;
      centerX = (bounds.minX + bounds.maxX) / 2;
      centerY = (bounds.minY + bounds.maxY) / 2;
    }

    // Try placing main kund at center
    if (count > 0) {
      if (isValidPlacement(centerX, centerY, true)) {
        kunds.push({
          id: uuidv4(),
          x: centerX,
          y: centerY,
          rotation: direction,
          number: num++,
          assignedTo: null,
          size: mainKundSize // set custom size for main kund
        });
      }
    }

    let ring = 1;
    while (num <= count && ring < 100) { // Limit rings to prevent infinite loops
      const radius = (mainKSize / 2) + (kSize / 2) + padding + (ring - 1) * (kSize + padding);
      const circumference = 2 * Math.PI * radius;
      const maxKundsInRing = Math.floor(circumference / (kSize + padding));
      const angleStep = (2 * Math.PI) / Math.max(1, maxKundsInRing);

      for (let i = 0; i < maxKundsInRing && num <= count; i++) {
        const angle = i * angleStep;
        // Apply global direction to the circular layout as well if desired, or just standard angles
        const cx = centerX + radius * Math.cos(angle);
        const cy = centerY + radius * Math.sin(angle);

        if (isValidPlacement(cx, cy, false)) {
          // For circular layout, we can rotate the Kund to face the center, or just use global direction.
          // The prompt says "circle around the main big kund", let's keep rotation consistent with global direction for now,
          // or we can face it outwards/inwards. Let's stick to global direction.
          kunds.push({
            id: uuidv4(),
            x: cx,
            y: cy,
            rotation: direction,
            number: num++,
            assignedTo: null
          });
        }
      }
      ring++;
    }
  } else {
    // Grid Layout
    if (polyData) {
      const { raw } = polyData;
      const gridPoints = raw.map(([x, y]) => toGridSpace(x, y));
      let minGx = Infinity, maxGx = -Infinity;
      let minGy = Infinity, maxGy = -Infinity;
      gridPoints.forEach(([gx, gy]) => {
        if (gx < minGx) minGx = gx;
        if (gx > maxGx) maxGx = gx;
        if (gy < minGy) minGy = gy;
        if (gy > maxGy) maxGy = gy;
      });

      let currentGy = minGy + kSize / 2;
      let num = 1;

      while (currentGy <= maxGy && num <= count) {
        let currentGx = minGx + kSize / 2;
        while (currentGx <= maxGx && num <= count) {
          const [cx, cy] = toCanvasSpace(currentGx, currentGy);
          
          if (isValidPlacement(cx, cy)) {
            kunds.push({
              id: uuidv4(),
              x: cx,
              y: cy,
              rotation: direction,
              number: num++,
              assignedTo: null
            });
          }
          currentGx += kSize + padding;
        }
        currentGy += kSize + padding;
      }
    } else {
      // Default grid layout if no polygon
      const cols = Math.ceil(Math.sqrt(count));
      let num = 1;
      const cPadding = (yagna.settings.canvasPadding || 0) * pxPerMeter;
      let currentGy = - (cols * (kSize + padding)) / 2 + kSize / 2 + cPadding;
      
      while (num <= count) {
        let currentGx = - (cols * (kSize + padding)) / 2 + kSize / 2 + cPadding;
        for (let col = 0; col < cols * 3; col++) {
          if (num > count) break;
          const [cx, cy] = toCanvasSpace(currentGx, currentGy);
          if (isValidPlacement(cx, cy)) {
            kunds.push({
              id: uuidv4(),
              x: cx,
              y: cy,
              rotation: direction,
              number: num++,
              assignedTo: null
            });
          }
          currentGx += kSize + padding;
        }
        currentGy += kSize + padding;
        if (currentGy > (cols * (kSize + padding)) * 5) break;
      }
    }
  }

  return kunds;
}
