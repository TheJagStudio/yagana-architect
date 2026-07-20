import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Image as KonvaImage } from 'react-konva';
import { Yagna, Kund } from '../types';
import { useStore } from '../store/useStore';
import { getPolygonCanvasPoints } from '../lib/layoutUtils';
import { Hand, MousePointer2, PenTool, Check, X, Layers, Map, Move } from 'lucide-react';

// Tile helper functions
function lon2tile(lon: number, zoom: number) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}
function lat2tile(lat: number, zoom: number) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}
function tile2lon(x: number, z: number) {
  return x / Math.pow(2, z) * 360 - 180;
}
function tile2lat(y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

interface TileProps {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function MapTileImage({ url, x, y, width, height }: TileProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // Crucial for html2canvas to work without security taint!
    img.src = url;
    img.onload = () => {
      if (active) {
        setImage(img);
      }
    };
    return () => {
      active = false;
    };
  }, [url]);

  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={0.85} // subtle transparency
    />
  );
}

interface Props {
  yagna: Yagna;
  stageRefCallback?: (stage: any) => void;
}

export default function KundCanvas({ yagna, stageRefCallback }: Props) {
  const allYagnas = useStore(state => state.yagnas);
  const visibleYagnas = allYagnas.filter(y => y.id === yagna.id || !y.hidden);
  const updateYagna = useStore(state => state.updateYagna);
  const updateKunds = useStore(state => state.updateKunds);
  const updateObjects = useStore(state => state.updateObjects);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const [mode, setMode] = useState<'pan' | 'select' | 'draw'>('pan');
  const [isGroundDraggable, setIsGroundDraggable] = useState(false);
  const [selectedKundId, setSelectedKundId] = useState<string | null>(null);
  const [selectedKundIds, setSelectedKundIds] = useState<string[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPoints, setIsEditingPoints] = useState(false);
  
  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<number[]>([]);
  const [draftObjectName, setDraftObjectName] = useState('Custom Area');
  const [mapStyle, setMapStyle] = useState<'light' | 'osm' | 'satellite' | 'none'>('light');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  useEffect(() => {
    setIsDeleting(false);
    setIsEditingPoints(false);
  }, [selectedObjectId]);

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  }, [yagna.id]);

  useEffect(() => {
    if (!containerRef.current) return;

    let animationFrameId: number;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      animationFrameId = requestAnimationFrame(() => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight
          });
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    setDimensions({
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight
    });

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleDragEnd = (e: any, kundId: string) => {
    if (e.target !== e.currentTarget) return;
    const node = e.target;
    // If dragging a selected item, move all selected items
    if (selectedKundIds.includes(kundId) && selectedKundIds.length > 1) {
      const dx = node.x() - yagna.kunds.find(k => k.id === kundId)!.x;
      const dy = node.y() - yagna.kunds.find(k => k.id === kundId)!.y;
      
      const updatedKunds = yagna.kunds.map(k => {
        if (selectedKundIds.includes(k.id)) {
          return { ...k, x: k.x + dx, y: k.y + dy };
        }
        return k;
      });
      updateKunds(yagna.id, updatedKunds);
    } else {
      const updatedKunds = yagna.kunds.map(k => {
        if (k.id === kundId) {
          return { ...k, x: node.x(), y: node.y() };
        }
        return k;
      });
      updateKunds(yagna.id, updatedKunds);
    }
  };

  const handleObjectDragEnd = (e: any, objId: string) => {
    if (e.target !== e.currentTarget) return;
    if (!yagna.objects) return;
    const updated = yagna.objects.map(o => {
      if (o.id === objId) {
        return {
          ...o,
          x: e.target.x(),
          y: e.target.y()
        };
      }
      return o;
    });
    updateObjects(yagna.id, updated);
  };

  const handleGroundDragEnd = (e: any) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    
    // Reset node position back to 0 so next render doesn't double-apply the offset
    node.x(0);
    node.y(0);
    node.getLayer().batchDraw();

    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return;

    // Convert pixels to meters
    const dMetersX = dx / pxPerMeter;
    const dMetersY = -dy / pxPerMeter; // Y-axis is inverted in canvas space compared to GPS space

    // Reference Latitude and Longitude
    const hasPolygon = yagna.polygon && yagna.polygon.length >= 3;
    const refLat = hasPolygon ? yagna.polygon[0].lat : (yagna.location?.lat ?? 28.6139);

    // Convert meters to lat/lng degrees
    const dLat = dMetersY / 110574;
    const dLng = dMetersX / (111320 * Math.cos(refLat * Math.PI / 180));

    // Shift all points in yagna.polygon
    let updatedPolygon = yagna.polygon || [];
    if (updatedPolygon.length > 0) {
      updatedPolygon = updatedPolygon.map(p => ({
        lat: p.lat + dLat,
        lng: p.lng + dLng
      }));
    }

    // Shift yagna.location as well
    const updatedLocation = yagna.location ? {
      lat: yagna.location.lat + dLat,
      lng: yagna.location.lng + dLng
    } : null;

    // Save to store!
    updateYagna(yagna.id, {
      polygon: updatedPolygon,
      location: updatedLocation
    });
  };

  const handleObjectTransform = (e: any, objId: string) => {
    if (!yagna.objects) return;
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    
    const updated = yagna.objects.map(o => {
      if (o.id === objId) {
        return {
          ...o,
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * scaleX),
          height: Math.max(20, node.height() * scaleY),
          rotation: node.rotation()
        };
      }
      return o;
    });
    updateObjects(yagna.id, updated);
  };

  const pxPerMeter = 50; // Arbitrary scale for rendering
  const kSize = yagna.settings.kundSize * pxPerMeter;

  const getC = (y: Yagna) => {
    if (!y.polygon || y.polygon.length < 3) return { cx: 0, cy: 0 };
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    const rLat = y.polygon[0].lat;
    const rLng = y.polygon[0].lng;
    y.polygon.forEach(p => {
      const x = (p.lng - rLng) * 111320 * Math.cos(rLat * Math.PI / 180) * pxPerMeter;
      const y = -(p.lat - rLat) * 110574 * pxPerMeter;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  };

  const getGlobalOffset = (yTarget: Yagna, yBase: Yagna) => {
    const targetHasPoly = yTarget.polygon && yTarget.polygon.length >= 3;
    const baseHasPoly = yBase.polygon && yBase.polygon.length >= 3;

    if (!targetHasPoly || !baseHasPoly) {
      // If one doesn't have a polygon but has a location, compute offset based on location
      const tLat = targetHasPoly ? yTarget.polygon![0].lat : (yTarget.location?.lat ?? 28.6139);
      const tLng = targetHasPoly ? yTarget.polygon![0].lng : (yTarget.location?.lng ?? 77.2090);
      const bLat = baseHasPoly ? yBase.polygon![0].lat : (yBase.location?.lat ?? 28.6139);
      const bLng = baseHasPoly ? yBase.polygon![0].lng : (yBase.location?.lng ?? 77.2090);
      const dx = (tLng - bLng) * 111320 * Math.cos(bLat * Math.PI / 180) * pxPerMeter;
      const dy = -(tLat - bLat) * 110574 * pxPerMeter;
      return { x: dx, y: dy };
    }
    
    const baseRefLat = yBase.polygon[0].lat;
    const baseRefLng = yBase.polygon[0].lng;
    const targetRefLat = yTarget.polygon[0].lat;
    const targetRefLng = yTarget.polygon[0].lng;

    const targetRefX = (targetRefLng - baseRefLng) * 111320 * Math.cos(baseRefLat * Math.PI / 180) * pxPerMeter;
    const targetRefY = -(targetRefLat - baseRefLat) * 110574 * pxPerMeter;

    const cBase = getC(yBase);
    const cTarget = getC(yTarget);

    const targetCenterInBase = {
      x: targetRefX + cTarget.cx,
      y: targetRefY + cTarget.cy
    };

    return {
      x: targetCenterInBase.x - cBase.cx,
      y: targetCenterInBase.y - cBase.cy
    };
  };

  // Calculate polygon points in canvas coordinates if available
  let polygonCanvasPoints: number[] = [];
  const polyData = getPolygonCanvasPoints(yagna, pxPerMeter);
  if (polyData) {
    polygonCanvasPoints = polyData.flat;
  }

  // Bounding box center coordinates in canvas space
  let centerX = 0;
  let centerY = 0;
  if (yagna.polygon && yagna.polygon.length >= 3) {
    const refLat = yagna.polygon[0].lat;
    const refLng = yagna.polygon[0].lng;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    yagna.polygon.forEach(p => {
      const xMeters = (p.lng - refLng) * 111320 * Math.cos(refLat * Math.PI / 180);
      const yMeters = (p.lat - refLat) * 110574;
      const x = xMeters * pxPerMeter;
      const y = -yMeters * pxPerMeter;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    centerX = (minX + maxX) / 2;
    centerY = (minY + maxY) / 2;
  }

  const gpsToCanvas = (lat: number, lng: number) => {
    const hasPolygon = yagna.polygon && yagna.polygon.length >= 3;
    const refLat = hasPolygon ? yagna.polygon![0].lat : (yagna.location?.lat ?? 28.6139);
    const refLng = hasPolygon ? yagna.polygon![0].lng : (yagna.location?.lng ?? 77.2090);
    
    const xMeters = (lng - refLng) * 111320 * Math.cos(refLat * Math.PI / 180);
    const yMeters = (lat - refLat) * 110574;
    
    const cx = xMeters * pxPerMeter - centerX;
    const cy = -yMeters * pxPerMeter - centerY;
    
    return { x: cx, y: cy };
  };

  const tiles: Array<{ url: string; x: number; y: number; width: number; height: number; key: string }> = [];
  if (mapStyle !== 'none' && visibleYagnas.length > 0) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    visibleYagnas.forEach(y => {
      if (y.polygon && y.polygon.length >= 3) {
        y.polygon.forEach(p => {
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lng < minLng) minLng = p.lng;
          if (p.lng > maxLng) maxLng = p.lng;
        });
      } else if (y.location) {
        const latDelta = 0.0009;
        const lngDelta = 0.0009 / Math.cos(y.location.lat * Math.PI / 180);
        if (y.location.lat - latDelta < minLat) minLat = y.location.lat - latDelta;
        if (y.location.lat + latDelta > maxLat) maxLat = y.location.lat + latDelta;
        if (y.location.lng - lngDelta < minLng) minLng = y.location.lng - lngDelta;
        if (y.location.lng + lngDelta > maxLng) maxLng = y.location.lng + lngDelta;
      }
    });

    if (minLat !== Infinity) {
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);
      
      let zoom = 18;
      if (maxDiff > 0.01) zoom = 15;
      else if (maxDiff > 0.005) zoom = 16;
      else if (maxDiff > 0.002) zoom = 17;
      else if (maxDiff > 0.0005) zoom = 18;
      else zoom = 19;

      const minTileX = lon2tile(minLng, zoom) - 1;
      const maxTileX = lon2tile(maxLng, zoom) + 1;
      const minTileY = lat2tile(maxLat, zoom) - 1;
      const maxTileY = lat2tile(minLat, zoom) + 1;

      const tileCountX = maxTileX - minTileX + 1;
      const tileCountY = maxTileY - minTileY + 1;
      
      // Safety limit for number of tiles to fetch
      if (tileCountX * tileCountY <= 150) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          for (let ty = minTileY; ty <= maxTileY; ty++) {
            const tlLat = tile2lat(ty, zoom);
            const tlLng = tile2lon(tx, zoom);
            const brLat = tile2lat(ty + 1, zoom);
            const brLng = tile2lon(tx + 1, zoom);

            const tl = gpsToCanvas(tlLat, tlLng);
            const br = gpsToCanvas(brLat, brLng);

            let url = '';
            if (mapStyle === 'light') {
              url = `https://basemaps.cartocdn.com/light_all/${zoom}/${tx}/${ty}.png`;
            } else if (mapStyle === 'osm') {
              url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
            } else if (mapStyle === 'satellite') {
              url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
            }

            if (url) {
              tiles.push({
                url,
                x: tl.x,
                y: tl.y,
                width: br.x - tl.x,
                height: br.y - tl.y,
                key: `${mapStyle}-${zoom}-${tx}-${ty}`
              });
            }
          }
        }
      }
    }
  }

  const getPointerPosition = (stage: any) => {
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(stage.getPointerPosition());
  };

  const handleStageMouseDown = (e: any) => {
    const isGround = (typeof e.target.name === 'function' && e.target.name() === 'ground') ||
                     (e.target.className === 'Line' && (e.target.fill() === '#e2e8f0' || e.target.fill() === 'rgba(251, 191, 36, 0.12)')) ||
                     (e.target.className === 'Rect' && (e.target.fill() === '#e2e8f0' || e.target.fill() === 'rgba(251, 191, 36, 0.12)'));

    if (e.target.className === 'Line' && !isGround) {
      // It's a custom polygon object, don't interfere
    }
    
    // Ignore if clicked on a Kund, object or other elements
    const isBackground = isGround || 
                         e.target.className === 'Image' || 
                         e.target === e.target.getStage();
    
    if (isBackground) {
      setSelectedKundId(null);
      setSelectedKundIds([]);
      setSelectedObjectId(null);
    }

    if (mode === 'select' && isBackground) {
      const pos = getPointerPosition(e.target.getStage());
      setSelectionRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    } else if (mode === 'draw' && isBackground) {
      const pos = getPointerPosition(e.target.getStage());
      setDrawingPoints([...drawingPoints, pos.x, pos.y]);
    }
  };

  const handleStageMouseMove = (e: any) => {
    if (mode === 'select' && selectionRect) {
      const pos = getPointerPosition(e.target.getStage());
      setSelectionRect({ ...selectionRect, x2: pos.x, y2: pos.y });
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (mode === 'select' && selectionRect) {
      const box = {
        minX: Math.min(selectionRect.x1, selectionRect.x2),
        maxX: Math.max(selectionRect.x1, selectionRect.x2),
        minY: Math.min(selectionRect.y1, selectionRect.y2),
        maxY: Math.max(selectionRect.y1, selectionRect.y2),
      };
      
      const selected = yagna.kunds.filter(k => 
        k.x >= box.minX && k.x <= box.maxX && k.y >= box.minY && k.y <= box.maxY
      );
      
      setSelectedKundIds(selected.map(k => k.id));
      setSelectionRect(null);
    }
  };

  const saveDrawnPolygon = () => {
    if (drawingPoints.length >= 6) {
      const newObj = {
        id: crypto.randomUUID(),
        type: 'polygon',
        name: draftObjectName,
        x: 0,
        y: 0,
        width: 100, // bounding box could be calculated here, keeping simple
        height: 100,
        rotation: 0,
        color: '#3b82f6', // blue
        points: drawingPoints
      };
      updateObjects(yagna.id, [...(yagna.objects || []), newObj]);
    }
    setDrawingPoints([]);
    setMode('pan');
  };

  return (
    <div className="w-full h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative" ref={containerRef}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <>
          <div className="absolute inset-0">
        <Stage
          ref={(node) => {
            stageRef.current = node;
            if (stageRefCallback) stageRefCallback(node);
          }}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x + dimensions.width / 2}
          y={position.y + dimensions.height / 2}
        draggable={mode === 'pan'}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage() && mode === 'pan') {
             setPosition({ x: e.target.x() - dimensions.width / 2, y: e.target.y() - dimensions.height / 2 });
          }
        }}
        onWheel={(e) => {
          e.evt.preventDefault();
          const scaleBy = 1.1;
          const stage = e.target.getStage();
          if (!stage) return;
          const oldScale = stage.scaleX();
          const mousePointTo = {
            x: stage.getPointerPosition()!.x / oldScale - stage.x() / oldScale,
            y: stage.getPointerPosition()!.y / oldScale - stage.y() / oldScale,
          };
          const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
          setScale(newScale);
          setPosition({
            x: -(mousePointTo.x - stage.getPointerPosition()!.x / newScale) * newScale - dimensions.width / 2,
            y: -(mousePointTo.y - stage.getPointerPosition()!.y / newScale) * newScale - dimensions.height / 2,
          });
        }}
      >
        <Layer>
          {/* Map background tiles (rendered first, at the bottom) */}
          {mapStyle !== 'none' && tiles.map(tile => (
            <MapTileImage
              key={tile.key}
              url={tile.url}
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
            />
          ))}

          {/* Iterate over visible yagnas */}
          {visibleYagnas.map((y) => {
            const offset = getGlobalOffset(y, yagna);
            const isCurrent = y.id === yagna.id;
            const polyPoints = getPolygonCanvasPoints(y, pxPerMeter)?.flat || [];
            
            return (
              <Group key={y.id} x={offset.x} y={offset.y} opacity={isCurrent ? 1 : 0.85}>
                {/* Ground / Area bounds */}
                {polyPoints.length >= 6 ? (
                  <Line
                    name="ground"
                    points={polyPoints}
                    fill={mapStyle !== 'none' ? "#fcd34d" : "#e2e8f0"}
                    stroke={isCurrent && isGroundDraggable ? "#3b82f6" : (mapStyle !== 'none' ? "#f59e0b" : "#cbd5e1")}
                    strokeWidth={isCurrent && isGroundDraggable ? 4 : (mapStyle !== 'none' ? 3 : 2)}
                    dash={isCurrent && isGroundDraggable ? [10, 5] : (mapStyle === 'satellite' ? [8, 5] : undefined)}
                    opacity={y.settings.groundOpacity !== undefined ? y.settings.groundOpacity : (mapStyle !== 'none' ? 0.25 : 1.0)}
                    closed={true}
                    draggable={isCurrent && isGroundDraggable}
                    onDragEnd={isCurrent ? handleGroundDragEnd : undefined}
                    onMouseEnter={(e) => {
                      if (isCurrent && isGroundDraggable) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onClick={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                    onTap={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                  />
                ) : (
                  <Rect
                    name="ground"
                    x={-(y.dimensions.width * pxPerMeter) / 2}
                    y={-(y.dimensions.height * pxPerMeter) / 2}
                    width={y.dimensions.width * pxPerMeter}
                    height={y.dimensions.height * pxPerMeter}
                    fill={mapStyle !== 'none' ? "#fcd34d" : "#e2e8f0"}
                    stroke={isCurrent && isGroundDraggable ? "#3b82f6" : (mapStyle !== 'none' ? "#f59e0b" : "#cbd5e1")}
                    strokeWidth={isCurrent && isGroundDraggable ? 4 : (mapStyle !== 'none' ? 3 : 2)}
                    dash={isCurrent && isGroundDraggable ? [10, 5] : (mapStyle === 'satellite' ? [8, 5] : undefined)}
                    opacity={y.settings.groundOpacity !== undefined ? y.settings.groundOpacity : (mapStyle !== 'none' ? 0.25 : 1.0)}
                    draggable={isCurrent && isGroundDraggable}
                    onDragEnd={isCurrent ? handleGroundDragEnd : undefined}
                    onMouseEnter={(e) => {
                      if (isCurrent && isGroundDraggable) {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onClick={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                    onTap={() => {
                       setSelectedKundId(null);
                       setSelectedKundIds([]);
                       setSelectedObjectId(null);
                    }}
                  />
                )}
                
                {y.kunds.map((kund) => {
                  const currentSize = (kund.size || y.settings.kundSize) * pxPerMeter;
                  const seatsCount = kund.seats || y.settings.sitsPerKund;
                  const isSelected = selectedKundId === kund.id || selectedKundIds.includes(kund.id);
                  
                  const kundColor = y.settings.kundColor || '#fcd34d';
                  const kundInnerColor = y.settings.kundInnerColor || '#f59e0b';
                  const seatColor = y.settings.seatColor || '#94a3b8';
                  const sWidth = (y.settings.seatWidth || 0.4) * pxPerMeter;
                  const sHeight = (y.settings.seatHeight || 0.4) * pxPerMeter;
                  const sOffset = (y.settings.seatOffset !== undefined ? y.settings.seatOffset : 0.3) * pxPerMeter;
                  const seatLayout = y.settings.seatLayout || 'circular';
                  const accessories = y.settings.kundAccessories || [];

                  const seatPositions: Array<{ x: number, y: number, rotation: number, color?: string }> = [];
                  if (y.settings.individualSeats && y.settings.individualSeats.length > 0) {
                    y.settings.individualSeats.forEach(seat => {
                      seatPositions.push({
                        x: seat.offsetX * pxPerMeter,
                        y: seat.offsetY * pxPerMeter,
                        rotation: seat.rotation,
                        color: seat.color
                      });
                    });
                  } else {
                    if (seatLayout === 'square') {
                      const sides: Array<any[]> = [[], [], [], []];
                      for (let i = 0; i < seatsCount; i++) {
                        sides[i % 4].push({});
                      }
                      sides[0].forEach((_, idx) => {
                        const count = sides[0].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const yOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const xOffset = -(currentSize / 2 + sOffset + sWidth / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 0 });
                      });
                      sides[1].forEach((_, idx) => {
                        const count = sides[1].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const yOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const xOffset = (currentSize / 2 + sOffset + sWidth / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 180 });
                      });
                      sides[2].forEach((_, idx) => {
                        const count = sides[2].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const xOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const yOffset = -(currentSize / 2 + sOffset + sHeight / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 90 });
                      });
                      sides[3].forEach((_, idx) => {
                        const count = sides[3].length;
                        const spacing = count > 1 ? currentSize / (count + 1) : currentSize / 2;
                        const xOffset = count > 1 ? -currentSize / 2 + spacing * (idx + 1) : 0;
                        const yOffset = (currentSize / 2 + sOffset + sHeight / 2);
                        seatPositions.push({ x: xOffset, y: yOffset, rotation: 270 });
                      });
                    } else {
                      const radius = (currentSize / 2) + sOffset + (Math.max(sWidth, sHeight) / 2);
                      for (let i = 0; i < seatsCount; i++) {
                        const angle = (i * (360 / seatsCount)) * (Math.PI / 180);
                        const cx = Math.cos(angle) * radius;
                        const cy = Math.sin(angle) * radius;
                        seatPositions.push({
                          x: cx,
                          y: cy,
                          rotation: (i * (360 / seatsCount)) + 90
                        });
                      }
                    }
                  }

                  return (
                    <Group
                      key={kund.id}
                      x={kund.x}
                      y={kund.y}
                      rotation={kund.rotation}
                      draggable={isCurrent && mode !== 'draw'}
                      onDragEnd={(e) => isCurrent ? handleDragEnd(e, kund.id) : undefined}
                      onClick={(e) => {
                        if (!isCurrent) return;
                        if (mode === 'select' && e.evt.shiftKey) {
                          setSelectedKundIds(prev => prev.includes(kund.id) ? prev.filter(id => id !== kund.id) : [...prev, kund.id]);
                        } else if (mode === 'select') {
                          setSelectedKundIds([kund.id]);
                        } else {
                          setSelectedKundId(kund.id);
                        }
                      }}
                    >
                      {seatPositions.map((pos, i) => (
                        <Group key={`seat-${i}`} x={pos.x} y={pos.y} rotation={pos.rotation}>
                          <Rect
                            x={-sWidth / 2}
                            y={-sHeight / 2}
                            width={sWidth}
                            height={sHeight}
                            fill={pos.color || seatColor}
                            stroke="#475569"
                            strokeWidth={1}
                            cornerRadius={2}
                          />
                          <Rect
                            x={-sWidth / 2}
                            y={-sHeight / 2}
                            width={sWidth * 0.15}
                            height={sHeight}
                            fill="#475569"
                            opacity={0.6}
                            cornerRadius={1}
                          />
                        </Group>
                      ))}

                      <Rect
                        x={-currentSize / 2}
                        y={-currentSize / 2}
                        width={currentSize}
                        height={currentSize}
                        fill={isSelected ? "#fbbf24" : kundColor}
                        stroke={isSelected ? "#ea580c" : "#b45309"}
                        strokeWidth={isSelected ? 3 : 2}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                      
                      <Rect
                        x={-currentSize / 3}
                        y={-currentSize / 3}
                        width={currentSize * (2/3)}
                        height={currentSize * (2/3)}
                        fill={kundInnerColor}
                        stroke="#b45309"
                        strokeWidth={1}
                      />

                      {accessories.map((acc) => {
                        const ax = acc.offsetX * pxPerMeter;
                        const ay = acc.offsetY * pxPerMeter;
                        const aw = acc.width * pxPerMeter;
                        const ah = acc.height * pxPerMeter;

                        if (acc.type === 'circle') {
                          return (
                            <Circle
                              key={acc.id}
                              x={ax}
                              y={ay}
                              radius={aw / 2}
                              fill={acc.color}
                              stroke="#475569"
                              strokeWidth={0.5}
                            />
                          );
                        } else if (acc.type === 'text') {
                          return (
                            <Text
                              key={acc.id}
                              x={ax - aw / 2}
                              y={ay - ah / 2}
                              width={aw}
                              height={ah}
                              text={acc.name}
                              fontSize={8}
                              align="center"
                              verticalAlign="middle"
                              fill={acc.color}
                              fontStyle="bold"
                            />
                          );
                        } else {
                          return (
                            <Rect
                              key={acc.id}
                              x={ax - aw / 2}
                              y={ay - ah / 2}
                              width={aw}
                              height={ah}
                              fill={acc.color}
                              stroke="#475569"
                              strokeWidth={0.5}
                              cornerRadius={1}
                            />
                          );
                        }
                      })}

                      <Text
                        text={kund.number.toString()}
                        fontSize={currentSize * 0.3}
                        fontStyle="bold"
                        fill="#78350f"
                        align="center"
                        verticalAlign="middle"
                        width={currentSize}
                        height={currentSize}
                        x={-currentSize / 2}
                        y={-currentSize / 2}
                      />
                    </Group>
                  );
                })}
                
                {(y.objects || []).map((obj) => (
                  <Group
                    key={obj.id}
                    x={obj.x}
                    y={obj.y}
                    rotation={obj.rotation}
                    draggable={isCurrent && mode !== 'draw' && !(isEditingPoints && selectedObjectId === obj.id)}
                    onDragEnd={(e) => isCurrent ? handleObjectDragEnd(e, obj.id) : undefined}
                    onTransformEnd={(e) => isCurrent ? handleObjectTransform(e, obj.id) : undefined}
                    onClick={(e) => {
                      if (!isCurrent) return;
                      e.cancelBubble = true;
                      setSelectedKundId(null);
                      setSelectedKundIds([]);
                      setSelectedObjectId(obj.id);
                    }}
                    onTap={(e) => {
                      if (!isCurrent) return;
                      e.cancelBubble = true;
                      setSelectedKundId(null);
                      setSelectedKundIds([]);
                      setSelectedObjectId(obj.id);
                    }}
                  >
                    {obj.points && obj.points.length >= 6 ? (
                      <Line
                        points={obj.points}
                        fill={obj.color || '#ec4899'}
                        stroke={selectedObjectId === obj.id ? "#fbbf24" : "#be185d"}
                        strokeWidth={selectedObjectId === obj.id ? 4 : 2}
                        opacity={0.8}
                        closed={true}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                    ) : (
                      <Rect
                        x={0}
                        y={0}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color || '#ec4899'}
                        stroke={selectedObjectId === obj.id ? "#fbbf24" : "#be185d"}
                        strokeWidth={selectedObjectId === obj.id ? 4 : 2}
                        opacity={0.8}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.2}
                      />
                    )}
                    {obj.points && obj.points.length >= 6 ? (
                      (() => {
                        let sumX = 0;
                        let sumY = 0;
                        let ptCount = 0;
                        for (let i = 0; i < obj.points.length; i += 2) {
                          sumX += obj.points[i];
                          sumY += obj.points[i+1];
                          ptCount++;
                        }
                        const avgX = ptCount > 0 ? sumX / ptCount : 0;
                        const avgY = ptCount > 0 ? sumY / ptCount : 0;
                        return (
                          <Text
                            text={obj.name}
                            fontSize={13}
                            fontStyle="bold"
                            fill="#ffffff"
                            align="center"
                            verticalAlign="middle"
                            x={avgX - 100}
                            y={avgY - 10}
                            width={200}
                            height={20}
                          />
                        );
                      })()
                    ) : (
                      <Text
                        text={obj.name}
                        fontSize={Math.min(obj.width || 100, obj.height || 100) * 0.3}
                        fontStyle="bold"
                        fill="#ffffff"
                        align="center"
                        verticalAlign="middle"
                        width={obj.width || 100}
                        height={obj.height || 100}
                        x={0}
                        y={0}
                      />
                    )}

                    {obj.points && isCurrent && isEditingPoints && selectedObjectId === obj.id && (
                      <Group>
                        {Array.from({ length: obj.points.length / 2 }).map((_, idx) => {
                          const xIdx = idx * 2;
                          const yIdx = idx * 2 + 1;
                          const px = obj.points![xIdx];
                          const py = obj.points![yIdx];
                          return (
                            <Circle
                              key={`ctrl-pt-${idx}`}
                              x={px}
                              y={py}
                              radius={7}
                              fill="#ffffff"
                              stroke="#2563eb"
                              strokeWidth={2.5}
                              shadowColor="black"
                              shadowBlur={3}
                              shadowOpacity={0.3}
                              draggable
                              onDragMove={(e) => {
                                e.cancelBubble = true;
                                const newX = e.target.x();
                                const newY = e.target.y();
                                
                                const points = [...obj.points!];
                                points[xIdx] = newX;
                                points[yIdx] = newY;
                                
                                const updated = y.objects.map(o => 
                                  o.id === obj.id ? { ...o, points } : o
                                );
                                updateObjects(y.id, updated);
                              }}
                              onDragEnd={(e) => {
                                e.cancelBubble = true;
                              }}
                              onMouseEnter={(e) => {
                                const stage = e.target.getStage();
                                if (stage) stage.container().style.cursor = 'move';
                              }}
                              onMouseLeave={(e) => {
                                const stage = e.target.getStage();
                                if (stage) stage.container().style.cursor = 'default';
                              }}
                            />
                          );
                        })}
                      </Group>
                    )}
                  </Group>
                ))}
              </Group>
            );
          })}

          {/* Active Drawing */}
          {drawingPoints.length > 0 && (
            <Line
              points={drawingPoints}
              stroke="#3b82f6"
              strokeWidth={3}
              closed={false}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {drawingPoints.map((p, i) => i % 2 === 0 && (
            <Circle 
              key={`dp-${i}`}
              x={drawingPoints[i]}
              y={drawingPoints[i+1]}
              radius={4}
              fill="#1d4ed8"
            />
          ))}

          {/* Selection Box */}
          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.abs(selectionRect.x1 - selectionRect.x2)}
              height={Math.abs(selectionRect.y1 - selectionRect.y2)}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={1}
            />
          )}
        </Layer>
      </Stage>
    </div>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 bg-white p-1 rounded-md shadow-md border border-slate-200 flex flex-col space-y-1 z-10">
        <button
          onClick={() => setMode('pan')}
          className={`p-2 rounded ${mode === 'pan' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          title="Pan Mode"
        >
          <Hand className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMode('select')}
          className={`p-2 rounded ${mode === 'select' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          title="Select Mode"
        >
          <MousePointer2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMode('draw')}
          className={`p-2 rounded ${mode === 'draw' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          title="Draw Polygon Object"
        >
          <PenTool className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setIsGroundDraggable(!isGroundDraggable);
            if (!isGroundDraggable) {
              // If enabling ground drag, clear active selection to focus on ground movement
              setSelectedKundId(null);
              setSelectedKundIds([]);
              setSelectedObjectId(null);
            }
          }}
          className={`p-2 rounded ${isGroundDraggable ? 'bg-amber-600 text-white hover:bg-amber-700 animate-pulse' : 'text-slate-600 hover:bg-slate-100'}`}
          title={isGroundDraggable ? "Dragging Active - Click & Drag Main Area" : "Move/Drag Main Area on Map"}
        >
          <Move className="w-5 h-5" />
        </button>
      </div>

      {/* Map Layers Selector */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-md text-xs font-semibold text-slate-700 transition-all cursor-pointer"
            title="Map Background Layers"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Map Layers</span>
          </button>
          
          {showLayerMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-20 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-1">
                Background style
              </div>
              <button
                onClick={() => { setMapStyle('none'); setShowLayerMenu(false); }}
                className={`px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors ${mapStyle === 'none' ? 'bg-slate-50 text-amber-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${mapStyle === 'none' ? 'bg-amber-500' : 'bg-transparent border border-slate-300'}`} />
                <span>Plain Grid (None)</span>
              </button>
              <button
                onClick={() => { setMapStyle('light'); setShowLayerMenu(false); }}
                className={`px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors ${mapStyle === 'light' ? 'bg-slate-50 text-amber-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${mapStyle === 'light' ? 'bg-amber-500' : 'bg-transparent border border-slate-300'}`} />
                <span>Light Schematic (Default)</span>
              </button>
              <button
                onClick={() => { setMapStyle('osm'); setShowLayerMenu(false); }}
                className={`px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors ${mapStyle === 'osm' ? 'bg-slate-50 text-amber-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${mapStyle === 'osm' ? 'bg-amber-500' : 'bg-transparent border border-slate-300'}`} />
                <span>Street Map (Detailed)</span>
              </button>
              <button
                onClick={() => { setMapStyle('satellite'); setShowLayerMenu(false); }}
                className={`px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors ${mapStyle === 'satellite' ? 'bg-slate-50 text-amber-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${mapStyle === 'satellite' ? 'bg-amber-500' : 'bg-transparent border border-slate-300'}`} />
                <span>Satellite Imagery</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawing Mode Actions */}
      {mode === 'draw' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center space-x-3 z-10">
          <input
            type="text"
            value={draftObjectName}
            onChange={(e) => setDraftObjectName(e.target.value)}
            className="text-sm px-2 py-1 border border-slate-300 rounded focus:outline-none"
            placeholder="Object Name"
          />
          <span className="text-sm text-slate-500 font-medium">Click on canvas to add points</span>
          <button 
            onClick={saveDrawnPolygon}
            disabled={drawingPoints.length < 6}
            className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-full disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
          </button>
          <button 
            onClick={() => { setDrawingPoints([]); setMode('pan'); }}
            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Kund Editor Overlay */}
      {selectedKundId && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-slate-200 w-64 z-10">
          <h4 className="font-semibold text-slate-800 mb-3 border-b pb-2">Edit Kund</h4>
          {(() => {
            const kund = yagna.kunds.find(k => k.id === selectedKundId);
            if (!kund) return null;
            return (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Seats (override)</label>
                  <input 
                    type="number" 
                    value={kund.seats || yagna.settings.sitsPerKund}
                    onChange={(e) => {
                      const updated = yagna.kunds.map(k => k.id === kund.id ? { ...k, seats: parseInt(e.target.value) || 0 } : k);
                      updateKunds(yagna.id, updated);
                    }}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rotation (degrees)</label>
                  <input 
                    type="number" 
                    value={kund.rotation}
                    onChange={(e) => {
                      const updated = yagna.kunds.map(k => k.id === kund.id ? { ...k, rotation: parseInt(e.target.value) || 0 } : k);
                      updateKunds(yagna.id, updated);
                    }}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Size (meters, override)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={kund.size || yagna.settings.kundSize}
                    onChange={(e) => {
                      const updated = yagna.kunds.map(k => k.id === kund.id ? { ...k, size: parseFloat(e.target.value) || yagna.settings.kundSize } : k);
                      updateKunds(yagna.id, updated);
                    }}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <button 
                  className="mt-2 w-full px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-sm font-medium transition-colors"
                  onClick={() => setSelectedKundId(null)}
                >
                  Close
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Selected Object Editor Overlay */}
      {selectedObjectId && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-slate-200 w-80 z-10 max-h-[85%] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h4 className="font-semibold text-slate-800">Edit Custom Object</h4>
            <button 
              onClick={() => setSelectedObjectId(null)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {(() => {
            const obj = (yagna.objects || []).find(o => o.id === selectedObjectId);
            if (!obj) return null;
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Object Name</label>
                  <input 
                    type="text" 
                    value={obj.name}
                    onChange={(e) => {
                      const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, name: e.target.value } : o);
                      updateObjects(yagna.id, updated);
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                {obj.points && obj.points.length > 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPoints(!isEditingPoints)}
                      className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition-all border ${
                        isEditingPoints 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-200' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{isEditingPoints ? 'Exit Point Editing Mode' : 'Toggle Visual Point Edit Mode'}</span>
                    </button>

                    {isEditingPoints && (
                      <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg p-2.5 text-xs">
                        <p className="font-semibold flex items-center space-x-1.5 mb-1 text-sky-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                          <span>Visual Drag Enabled</span>
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          Drag the white circles on the shape directly inside the canvas to resize and adjust the boundaries in real-time.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="color" 
                      value={obj.color || '#ec4899'}
                      onChange={(e) => {
                        const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, color: e.target.value } : o);
                        updateObjects(yagna.id, updated);
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <input 
                      type="text" 
                      value={obj.color || '#ec4899'}
                      onChange={(e) => {
                        const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, color: e.target.value } : o);
                        updateObjects(yagna.id, updated);
                      }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none"
                    />
                  </div>
                </div>

                {obj.points && obj.points.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Polygon Points</span>
                      <button 
                        onClick={() => {
                          const points = [...(obj.points || [])];
                          if (points.length >= 2) {
                            const lastX = points[points.length - 2];
                            const lastY = points[points.length - 1];
                            points.push(lastX + 40, lastY + 40);
                            const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, points } : o);
                            updateObjects(yagna.id, updated);
                          }
                        }}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-2 py-1 rounded"
                      >
                        + Add Point
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 p-2 rounded bg-slate-50">
                      {Array.from({ length: obj.points.length / 2 }).map((_, idx) => {
                        const xIdx = idx * 2;
                        const yIdx = idx * 2 + 1;
                        return (
                          <div key={idx} className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono text-slate-400 w-4">#{idx+1}</span>
                            <div className="grid grid-cols-2 gap-1 flex-1">
                              <div>
                                <label className="block text-[8px] text-slate-400">X</label>
                                <input 
                                  type="number" 
                                  value={Math.round(obj.points![xIdx])}
                                  onChange={(e) => {
                                    const points = [...obj.points!];
                                    points[xIdx] = parseInt(e.target.value) || 0;
                                    const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, points } : o);
                                    updateObjects(yagna.id, updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] text-slate-400">Y</label>
                                <input 
                                  type="number" 
                                  value={Math.round(obj.points![yIdx])}
                                  onChange={(e) => {
                                    const points = [...obj.points!];
                                    points[yIdx] = parseInt(e.target.value) || 0;
                                    const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, points } : o);
                                    updateObjects(yagna.id, updated);
                                  }}
                                  className="w-full px-1.5 py-0.5 text-xs border border-slate-300 rounded focus:outline-none"
                                />
                              </div>
                            </div>
                            <button 
                              disabled={obj.points!.length <= 6}
                              onClick={() => {
                                const points = obj.points!.filter((_, pIdx) => pIdx !== xIdx && pIdx !== yIdx);
                                const updated = yagna.objects.map(o => o.id === obj.id ? { ...o, points } : o);
                                updateObjects(yagna.id, updated);
                              }}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded disabled:opacity-30 mt-3"
                              title="Delete Point"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t flex flex-col space-y-2">
                  {isDeleting ? (
                    <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                      <p className="text-xs text-red-700 mb-2 font-medium">Are you sure you want to delete this object?</p>
                      <div className="flex space-x-2 justify-center">
                        <button
                          onClick={() => {
                            const updated = (yagna.objects || []).filter(o => o.id !== obj.id);
                            updateObjects(yagna.id, updated);
                            setSelectedObjectId(null);
                            setIsDeleting(false);
                          }}
                          className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setIsDeleting(false)}
                          className="px-2.5 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex space-x-2 w-full">
                      <button 
                        onClick={() => setIsDeleting(true)}
                        className="flex-1 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded font-medium transition-colors border border-red-200 text-center"
                      >
                        Delete Object
                      </button>
                      <button 
                        onClick={() => setSelectedObjectId(null)}
                        className="flex-1 py-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 rounded font-medium transition-colors text-center"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
        </>
      )}
    </div>
  );
}
