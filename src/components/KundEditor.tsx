import { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import { Yagna, KundAccessory, IndividualSeat } from '../types';
import { useStore } from '../store/useStore';
import { 
  Save, 
  Plus, 
  Trash2, 
  Palette, 
  Move, 
  Sparkles, 
  Check, 
  Type, 
  Square, 
  Circle as CircleIcon,
  Layers,
  Sliders,
  Info,
  RotateCw,
  RefreshCw,
  UserCheck
} from 'lucide-react';

interface Props {
  yagna: Yagna;
}

// Procedural generator helper
const generateDefaultSeats = (
  count: number,
  size: number,
  layout: 'circular' | 'square',
  offset: number,
  sWidth: number,
  sHeight: number,
  defaultColor?: string
): IndividualSeat[] => {
  const defaultSeats: IndividualSeat[] = [];
  if (layout === 'square') {
    const sides: Array<number[]> = [[], [], [], []]; // Left, Right, Top, Bottom
    for (let i = 0; i < count; i++) {
      sides[i % 4].push(i);
    }
    
    // Left / West
    sides[0].forEach((originalIndex, idx) => {
      const sideCount = sides[0].length;
      const spacing = sideCount > 1 ? size / (sideCount + 1) : size / 2;
      const yOffset = sideCount > 1 ? -size / 2 + spacing * (idx + 1) : 0;
      const xOffset = -(size / 2 + offset + sWidth / 2);
      defaultSeats.push({
        id: `seat-${originalIndex}`,
        offsetX: xOffset,
        offsetY: yOffset,
        rotation: 0,
        color: defaultColor
      });
    });
    // Right / East
    sides[1].forEach((originalIndex, idx) => {
      const sideCount = sides[1].length;
      const spacing = sideCount > 1 ? size / (sideCount + 1) : size / 2;
      const yOffset = sideCount > 1 ? -size / 2 + spacing * (idx + 1) : 0;
      const xOffset = (size / 2 + offset + sWidth / 2);
      defaultSeats.push({
        id: `seat-${originalIndex}`,
        offsetX: xOffset,
        offsetY: yOffset,
        rotation: 180,
        color: defaultColor
      });
    });
    // Top / North
    sides[2].forEach((originalIndex, idx) => {
      const sideCount = sides[2].length;
      const spacing = sideCount > 1 ? size / (sideCount + 1) : size / 2;
      const xOffset = sideCount > 1 ? -size / 2 + spacing * (idx + 1) : 0;
      const yOffset = -(size / 2 + offset + sHeight / 2);
      defaultSeats.push({
        id: `seat-${originalIndex}`,
        offsetX: xOffset,
        offsetY: yOffset,
        rotation: 90,
        color: defaultColor
      });
    });
    // Bottom / South
    sides[3].forEach((originalIndex, idx) => {
      const sideCount = sides[3].length;
      const spacing = sideCount > 1 ? size / (sideCount + 1) : size / 2;
      const xOffset = sideCount > 1 ? -size / 2 + spacing * (idx + 1) : 0;
      const yOffset = (size / 2 + offset + sHeight / 2);
      defaultSeats.push({
        id: `seat-${originalIndex}`,
        offsetX: xOffset,
        offsetY: yOffset,
        rotation: 270,
        color: defaultColor
      });
    });
  } else {
    // Circular
    const radius = (size / 2) + offset + (Math.max(sWidth, sHeight) / 2);
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count)) * (Math.PI / 180);
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;
      defaultSeats.push({
        id: `seat-${i}`,
        offsetX: cx,
        offsetY: cy,
        rotation: (i * (360 / count)) + 90,
        color: defaultColor
      });
    }
  }
  return defaultSeats.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
};

export default function KundEditor({ yagna }: Props) {
  const updateYagna = useStore((state) => state.updateYagna);

  // Read initial values from settings or fallback to defaults
  const [kundSize, setKundSize] = useState(yagna.settings.kundSize || 1.5);
  const [sitsCount, setSitsCount] = useState(yagna.settings.sitsPerKund || 4);
  const [seatOffset, setSeatOffset] = useState(yagna.settings.seatOffset !== undefined ? yagna.settings.seatOffset : 0.3);
  const [seatWidth, setSeatWidth] = useState(yagna.settings.seatWidth || 0.4);
  const [seatHeight, setSeatHeight] = useState(yagna.settings.seatHeight || 0.4);
  const [seatLayout, setSeatLayout] = useState<'circular' | 'square'>(yagna.settings.seatLayout || 'circular');
  
  const [kundColor, setKundColor] = useState(yagna.settings.kundColor || '#fcd34d');
  const [kundInnerColor, setKundInnerColor] = useState(yagna.settings.kundInnerColor || '#f59e0b');
  const [seatColor, setSeatColor] = useState(yagna.settings.seatColor || '#94a3b8');

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'dimensions' | 'style' | 'seats' | 'accessories'>('dimensions');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Selected seat id for inline style configuration
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);

  // Individual seats state
  const [seats, setSeats] = useState<IndividualSeat[]>(() => {
    if (yagna.settings.individualSeats && yagna.settings.individualSeats.length > 0) {
      return yagna.settings.individualSeats;
    }
    return generateDefaultSeats(
      yagna.settings.sitsPerKund || 4,
      yagna.settings.kundSize || 1.5,
      yagna.settings.seatLayout || 'circular',
      yagna.settings.seatOffset !== undefined ? yagna.settings.seatOffset : 0.3,
      yagna.settings.seatWidth || 0.4,
      yagna.settings.seatHeight || 0.4,
      yagna.settings.seatColor || '#94a3b8'
    );
  });

  // Track if seats have been customized manually (to show indicator and reset button)
  const [isCustomized, setIsCustomized] = useState(
    !!yagna.settings.individualSeats && yagna.settings.individualSeats.length > 0
  );

  const [accessories, setAccessories] = useState<KundAccessory[]>(
    yagna.settings.kundAccessories || []
  );

  // Trigger regeneration of default seats when dimensions change, but only if they haven't explicitly set isCustomized
  // Or let them change sliders and see real-time updates. If they haven't explicitly customized, keep updating procedurally.
  useEffect(() => {
    if (!isCustomized) {
      const generated = generateDefaultSeats(
        sitsCount,
        kundSize,
        seatLayout,
        seatOffset,
        seatWidth,
        seatHeight,
        seatColor
      );
      setSeats(generated);
    }
  }, [sitsCount, kundSize, seatLayout, seatOffset, seatWidth, seatHeight, seatColor, isCustomized]);

  // Dynamic Scale Calculation to prevent cropping of big Kunds (e.g., 3m size)
  const canvasSize = 400;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;

  // Total footprint boundary size in meters
  const totalMaxSeatDim = Math.max(seatWidth, seatHeight);
  
  // Calculate footprint of the seating layout.
  // For safety, let's find the max coordinate from the current seats list, plus seat size.
  let maxSeatRadius = 0;
  if (seats.length > 0) {
    seats.forEach(s => {
      const dist = Math.sqrt(s.offsetX * s.offsetX + s.offsetY * s.offsetY);
      if (dist > maxSeatRadius) {
        maxSeatRadius = dist;
      }
    });
  }
  
  // Total footprint diameter or bounding size
  const totalFootprintSize = Math.max(
    kundSize + 2 * (seatOffset + totalMaxSeatDim),
    (maxSeatRadius * 2) + totalMaxSeatDim
  );

  // Scale pixels per meter dynamically! Leave 35% margin for labels & safety padding.
  const previewPxPerMeter = Math.min(180, canvasSize / (totalFootprintSize * 1.35));

  // Preset Colors
  const colorPresets = {
    kund: ['#fcd34d', '#f59e0b', '#ef4444', '#b45309', '#f87171', '#fbbf24', '#ffffff'],
    inner: ['#f59e0b', '#d97706', '#b45309', '#78350f', '#dc2626', '#fcd34d', '#e2e8f0'],
    seat: ['#94a3b8', '#64748b', '#475569', '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#ffffff'],
    accessory: ['#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#e2e8f0']
  };

  const handleAddAccessory = (type: 'rect' | 'circle' | 'text') => {
    const newAcc: KundAccessory = {
      id: crypto.randomUUID(),
      name: type === 'text' ? 'Priest Label' : type === 'circle' ? 'Puja Bowl' : 'Priest Seat',
      type,
      offsetX: type === 'text' ? 0 : -0.8,
      offsetY: type === 'text' ? -0.8 : 0.8,
      width: type === 'text' ? 0.6 : type === 'circle' ? 0.25 : 0.45,
      height: type === 'text' ? 0.2 : type === 'circle' ? 0.25 : 0.45,
      color: type === 'text' ? '#78350f' : type === 'circle' ? '#06b6d4' : '#64748b'
    };
    setAccessories([...accessories, newAcc]);
  };

  const handleUpdateAccessory = (id: string, updates: Partial<KundAccessory>) => {
    setAccessories(
      accessories.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    );
  };

  const handleDeleteAccessory = (id: string) => {
    setAccessories(accessories.filter((acc) => acc.id !== id));
  };

  const handleSave = () => {
    updateYagna(yagna.id, {
      settings: {
        ...yagna.settings,
        kundSize,
        sitsPerKund: sitsCount,
        seatOffset,
        seatWidth,
        seatHeight,
        seatLayout,
        kundColor,
        kundInnerColor,
        seatColor,
        kundAccessories: accessories,
        individualSeats: isCustomized ? seats : undefined // If not customized, let standard procedurals run
      }
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Seats individual interactions
  const handleResetToDefaultGrid = () => {
    const generated = generateDefaultSeats(
      sitsCount,
      kundSize,
      seatLayout,
      seatOffset,
      seatWidth,
      seatHeight,
      seatColor
    );
    setSeats(generated);
    setIsCustomized(false);
    setSelectedSeatId(null);
  };

  const handleSeatDragEnd = (id: string, x: number, y: number) => {
    // x and y are the final position in pixels relative to center
    const offsetX = x / previewPxPerMeter;
    const offsetY = y / previewPxPerMeter;

    setSeats(prevSeats => 
      prevSeats.map(s => 
        s.id === id ? { ...s, offsetX, offsetY } : s
      )
    );
    setIsCustomized(true);
    setSelectedSeatId(id); // Select the dragged seat automatically for easy customization!
  };

  const handleAccessoryDragEnd = (id: string, x: number, y: number) => {
    // x and y are final relative pixel positions
    const offsetX = x / previewPxPerMeter;
    const offsetY = y / previewPxPerMeter;
    handleUpdateAccessory(id, { offsetX, offsetY });
  };

  const handleAddCustomSeat = () => {
    const newId = `custom-seat-${crypto.randomUUID().slice(0, 5)}`;
    // Position newly added seat slightly offset so it doesn't overlap center
    const newSeat: IndividualSeat = {
      id: newId,
      offsetX: 0,
      offsetY: -(kundSize / 2 + seatOffset + seatHeight / 2),
      rotation: 0,
      color: seatColor
    };
    setSeats([...seats, newSeat]);
    setIsCustomized(true);
    setSelectedSeatId(newId);
    setActiveSubTab('seats'); // Switch tab to seats to show settings
  };

  const handleUpdateSeatProperty = (id: string, updates: Partial<IndividualSeat>) => {
    setSeats(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setIsCustomized(true);
  };

  const handleDeleteSeat = (id: string) => {
    setSeats(prev => prev.filter(s => s.id !== id));
    setIsCustomized(true);
    if (selectedSeatId === id) {
      setSelectedSeatId(null);
    }
  };

  // Render variables for preview
  const previewSize = kundSize * previewPxPerMeter;
  const previewSWidth = seatWidth * previewPxPerMeter;
  const previewSHeight = seatHeight * previewPxPerMeter;

  return (
    <div id="kund-editor-container" className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden">
      {/* Control Panel (Left Side) */}
      <div className="w-full lg:w-[480px] border-r border-slate-200 bg-white flex flex-col h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800">Kund Template Designer</h3>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded shadow-sm transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Apply Globally</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md flex items-center space-x-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Kund template applied and migrated to all layout Kunds!</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-4 pt-2">
          <button
            onClick={() => setActiveSubTab('dimensions')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2 text-sm font-medium border-b-2 transition-all ${
              activeSubTab === 'dimensions'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Dimensions</span>
          </button>
          <button
            onClick={() => setActiveSubTab('style')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2 text-sm font-medium border-b-2 transition-all ${
              activeSubTab === 'style'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Colors</span>
          </button>
          <button
            onClick={() => setActiveSubTab('seats')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2 text-sm font-medium border-b-2 transition-all ${
              activeSubTab === 'seats'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-sky-500" />
            <span>Seats ({seats.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('accessories')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2 text-sm font-medium border-b-2 transition-all ${
              activeSubTab === 'accessories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Accessories ({accessories.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 flex-1 space-y-6">
          {activeSubTab === 'dimensions' && (
            <div className="space-y-5">
              {/* Reset to Grid notification if custom positions are active */}
              {isCustomized && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    <span>Custom positions are active.</span>
                  </div>
                  <button
                    onClick={handleResetToDefaultGrid}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-[10px] text-amber-900 border border-amber-300 rounded font-bold transition-all flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset to Grid</span>
                  </button>
                </div>
              )}

              {/* Kund Size */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">Inner Kund Size (Meters)</label>
                  <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                    {kundSize.toFixed(2)} m
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">The side length of the square-shaped central fire fireplace.</p>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={kundSize}
                    onChange={(e) => setKundSize(Number(e.target.value))}
                    className="flex-1 accent-slate-900 cursor-pointer"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={kundSize}
                    onChange={(e) => setKundSize(Math.max(0.2, Number(e.target.value)))}
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Seats layout pattern */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Seating Arrangement Pattern</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSeatLayout('circular')}
                    className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-all ${
                      seatLayout === 'circular'
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-400 mb-1 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    </div>
                    <span className="text-xs font-medium">Circular / Radial</span>
                  </button>
                  <button
                    onClick={() => setSeatLayout('square')}
                    className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-all ${
                      seatLayout === 'square'
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="w-5 h-5 border-2 border-dashed border-slate-400 rounded mb-1"></div>
                    <span className="text-xs font-medium">Square Sides</span>
                  </button>
                </div>
              </div>

              {/* Seats per Kund */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">Chairs / Seats Per Kund</label>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {sitsCount} seats
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="1"
                    max="16"
                    step="1"
                    value={sitsCount}
                    onChange={(e) => setSitsCount(Number(e.target.value))}
                    className="flex-1 accent-slate-900 cursor-pointer"
                  />
                  <input
                    type="number"
                    value={sitsCount}
                    onChange={(e) => setSitsCount(Math.max(1, Math.min(32, Number(e.target.value))))}
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Seat Offset */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">Seating Offset Distance (Meters)</label>
                  <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                    {seatOffset.toFixed(2)} m
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">The physical distance between the outer Kund edge and the chair front edge.</p>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0.0"
                    max="1.5"
                    step="0.05"
                    value={seatOffset}
                    onChange={(e) => setSeatOffset(Number(e.target.value))}
                    className="flex-1 accent-slate-900 cursor-pointer"
                  />
                  <input
                    type="number"
                    step="0.05"
                    value={seatOffset}
                    onChange={(e) => setSeatOffset(Math.max(0, Number(e.target.value)))}
                    className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center"
                  />
                </div>
              </div>

              {/* Seat Width & Height */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chair Width (Meters)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={seatWidth}
                    onChange={(e) => setSeatWidth(Math.max(0.1, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Chair Depth (Meters)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={seatHeight}
                    onChange={(e) => setSeatHeight(Math.max(0.1, Number(e.target.value)))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'style' && (
            <div className="space-y-6">
              {/* Kund Color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Outer Rim Color</label>
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="color"
                    value={kundColor}
                    onChange={(e) => setKundColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-200"
                  />
                  <input
                    type="text"
                    value={kundColor}
                    onChange={(e) => setKundColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.kund.map((c) => (
                    <button
                      key={c}
                      onClick={() => setKundColor(c)}
                      className="w-7 h-7 rounded-full border border-slate-200 transition-all hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Kund Inner Color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Inner Fireplace Color</label>
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="color"
                    value={kundInnerColor}
                    onChange={(e) => setKundInnerColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-200"
                  />
                  <input
                    type="text"
                    value={kundInnerColor}
                    onChange={(e) => setKundInnerColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.inner.map((c) => (
                    <button
                      key={c}
                      onClick={() => setKundInnerColor(c)}
                      className="w-7 h-7 rounded-full border border-slate-200 transition-all hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Seat Color */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Default Chair / Seating Color</label>
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="color"
                    value={seatColor}
                    onChange={(e) => setSeatColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-200"
                  />
                  <input
                    type="text"
                    value={seatColor}
                    onChange={(e) => setSeatColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.seat.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSeatColor(c)}
                      className="w-7 h-7 rounded-full border border-slate-200 transition-all hover:scale-110"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'seats' && (
            <div className="space-y-4">
              <div className="p-3 bg-sky-50 border border-sky-100 rounded text-xs text-sky-800 flex items-start space-x-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-sky-600" />
                <span>
                  <strong>Drag & Drop Seats directly on the canvas!</strong> Click a seat to edit its individual color, angle, or delete it completely.
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm font-semibold text-slate-700">Individual Seat Customization</span>
                <button
                  onClick={handleAddCustomSeat}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded font-medium shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Extra Seat</span>
                </button>
              </div>

              {/* Clear override / Reset default */}
              {isCustomized && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                  <span className="font-medium text-slate-600">Manual positioning active</span>
                  <button
                    onClick={handleResetToDefaultGrid}
                    className="text-amber-700 hover:text-amber-900 font-bold flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Layout Grid</span>
                  </button>
                </div>
              )}

              {/* Selected Seat Controls */}
              {selectedSeatId && (
                <div className="p-4 border-2 border-sky-300 rounded-xl bg-sky-50/50 space-y-3 shadow-sm animate-fade-in">
                  {(() => {
                    const activeSeat = seats.find(s => s.id === selectedSeatId);
                    if (!activeSeat) return <p className="text-xs text-slate-400">Seat not found</p>;
                    const seatIndex = seats.findIndex(s => s.id === selectedSeatId) + 1;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                            Configuring Seat #{seatIndex}
                          </span>
                          <button
                            onClick={() => handleDeleteSeat(activeSeat.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-all"
                            title="Delete Seat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Position (meters) */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">
                              Offset X (meters)
                            </label>
                            <input
                              type="number"
                              step="0.05"
                              value={activeSeat.offsetX.toFixed(2)}
                              onChange={(e) => handleUpdateSeatProperty(activeSeat.id, { offsetX: Number(e.target.value) })}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">
                              Offset Y (meters)
                            </label>
                            <input
                              type="number"
                              step="0.05"
                              value={activeSeat.offsetY.toFixed(2)}
                              onChange={(e) => handleUpdateSeatProperty(activeSeat.id, { offsetY: Number(e.target.value) })}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-center"
                            />
                          </div>
                        </div>

                        {/* Rotation slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Rotation (degrees)</label>
                            <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-1.5 py-0.25 rounded">
                              {activeSeat.rotation}°
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="5"
                              value={activeSeat.rotation}
                              onChange={(e) => handleUpdateSeatProperty(activeSeat.id, { rotation: Number(e.target.value) })}
                              className="flex-1 accent-sky-600 cursor-pointer"
                            />
                            <button
                              onClick={() => handleUpdateSeatProperty(activeSeat.id, { rotation: (activeSeat.rotation + 90) % 360 })}
                              className="p-1 hover:bg-sky-200 text-sky-800 rounded border border-sky-300 bg-white"
                              title="Rotate 90°"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Color Picker Override */}
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1.5">
                            Individual Seat Color Override
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={activeSeat.color || seatColor}
                              onChange={(e) => handleUpdateSeatProperty(activeSeat.id, { color: e.target.value })}
                              className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                            />
                            <div className="flex gap-1 flex-wrap">
                              {colorPresets.seat.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => handleUpdateSeatProperty(activeSeat.id, { color: c })}
                                  className="w-4 h-4 rounded-full border border-slate-200 transition-transform hover:scale-110"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                              <button
                                onClick={() => handleUpdateSeatProperty(activeSeat.id, { color: undefined })}
                                className="px-1.5 py-0.5 rounded border border-slate-300 bg-white text-[9px] font-bold text-slate-600 hover:bg-slate-100"
                                title="Use default global color"
                              >
                                Default
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* List of all seats */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                  All Physical Seats List
                </span>
                {seats.map((seat, index) => {
                  const isSelected = selectedSeatId === seat.id;
                  return (
                    <div
                      key={seat.id}
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/40 ring-1 ring-sky-500 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className="w-5 h-5 rounded border border-slate-300 shadow-inner flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: seat.color || seatColor }}
                        >
                          <span className={seat.color === '#ffffff' ? 'text-slate-800' : 'text-white'}>
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-700">Seat #{index + 1}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            X: {seat.offsetX.toFixed(2)}m, Y: {seat.offsetY.toFixed(2)}m
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleUpdateSeatProperty(seat.id, { rotation: (seat.rotation + 45) % 360 })}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded"
                          title="Rotate +45°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSeat(seat.id)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded"
                          title="Delete Seat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSubTab === 'accessories' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 flex items-start space-x-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Relative Accessories let you attach custom objects like priest cushions, ritual mats, camphor bowls, or custom text relative to the center of each Kund.
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm font-medium text-slate-700">Add Accessory</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAddAccessory('rect')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-all"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                    <span>Seat/Mat</span>
                  </button>
                  <button
                    onClick={() => handleAddAccessory('circle')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-all"
                  >
                    <CircleIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Bowl/Pot</span>
                  </button>
                  <button
                    onClick={() => handleAddAccessory('text')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-all"
                  >
                    <Type className="w-3.5 h-3.5 text-slate-500" />
                    <span>Label</span>
                  </button>
                </div>
              </div>

              {accessories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No accessories added. Click above to attach your first accessory.
                </div>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {accessories.map((acc, idx) => (
                    <div key={acc.id} className="p-3.5 border border-slate-200 rounded-lg bg-slate-50 relative space-y-3.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-slate-200 font-semibold px-1.5 py-0.5 rounded text-slate-700">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={acc.name}
                            onChange={(e) => handleUpdateAccessory(acc.id, { name: e.target.value })}
                            className="font-semibold text-sm text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteAccessory(acc.id)}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-[10px] bg-sky-50 border border-sky-100 text-sky-700 px-2 py-1 rounded font-medium flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                        <span>Drag on preview canvas to position</span>
                      </div>

                      {/* Dimension controls */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                            Width (meters)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={acc.width}
                            onChange={(e) => handleUpdateAccessory(acc.id, { width: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-shadow"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                            Height (meters)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            value={acc.height}
                            onChange={(e) => handleUpdateAccessory(acc.id, { height: Number(e.target.value) })}
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-shadow"
                          />
                        </div>
                      </div>

                      {/* Color picker */}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <div className="flex items-center space-x-2">
                          <label className="text-xs font-medium text-slate-500">Color:</label>
                          <input
                            type="color"
                            value={acc.color}
                            onChange={(e) => handleUpdateAccessory(acc.id, { color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border border-slate-200"
                          />
                        </div>
                        <div className="flex gap-1">
                          {colorPresets.accessory.map((c) => (
                            <button
                              key={c}
                              onClick={() => handleUpdateAccessory(acc.id, { color: c })}
                              className="w-4.5 h-4.5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Preview Canvas (Right Side) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-slate-100 relative min-h-[400px]">
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded border border-slate-200 shadow-sm text-xs text-slate-600 space-y-1">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
            <span className="font-medium">Scale: 1.0 Meter = {previewPxPerMeter.toFixed(1)} pixels</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 border-2 border-dashed border-sky-400 inline-block"></span>
            <span className="font-medium">Seating footprint: {totalFootprintSize.toFixed(2)}m × {totalFootprintSize.toFixed(2)}m</span>
          </div>
        </div>

        {/* Floating Save Reminder */}
        <div className="absolute top-4 right-4 bg-slate-900/5 text-slate-800 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Drag Seats & Accessories</span>
        </div>

        {/* Canvas container card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative p-4">
          <Stage width={canvasSize} height={canvasSize}>
            <Layer>
              {/* Outer Footprint boundary box */}
              <Rect
                x={centerX - (totalFootprintSize * previewPxPerMeter) / 2}
                y={centerY - (totalFootprintSize * previewPxPerMeter) / 2}
                width={totalFootprintSize * previewPxPerMeter}
                height={totalFootprintSize * previewPxPerMeter}
                stroke="#38bdf8"
                strokeWidth={1.5}
                dash={[6, 4]}
                cornerRadius={8}
              />
              <Text
                x={centerX - (totalFootprintSize * previewPxPerMeter) / 2}
                y={centerY - (totalFootprintSize * previewPxPerMeter) / 2 - 16}
                width={totalFootprintSize * previewPxPerMeter}
                text={`Dynamic View Limit: ${totalFootprintSize.toFixed(2)} m`}
                align="center"
                fontSize={11}
                fill="#0369a1"
                fontStyle="bold"
              />

              {/* Grid axes */}
              <Line
                points={[0, centerY, canvasSize, centerY]}
                stroke="#cbd5e1"
                strokeWidth={0.5}
                dash={[4, 4]}
              />
              <Line
                points={[centerX, 0, centerX, canvasSize]}
                stroke="#cbd5e1"
                strokeWidth={0.5}
                dash={[4, 4]}
              />

              {/* Centered Kund Group */}
              <Group x={centerX} y={centerY}>
                {/* Drag-and-drop Seats rendering! */}
                {seats.map((seat, i) => {
                  const isSelected = selectedSeatId === seat.id;
                  const seatX = seat.offsetX * previewPxPerMeter;
                  const seatY = seat.offsetY * previewPxPerMeter;

                  return (
                    <Group
                      key={seat.id}
                      x={seatX}
                      y={seatY}
                      rotation={seat.rotation}
                      draggable
                      onDragEnd={(e) => {
                        handleSeatDragEnd(seat.id, e.target.x(), e.target.y());
                      }}
                      onClick={() => setSelectedSeatId(seat.id)}
                      onTap={() => setSelectedSeatId(seat.id)}
                    >
                      {/* Interactive Touch Target */}
                      <Rect
                        x={-previewSWidth / 2 - 4}
                        y={-previewSHeight / 2 - 4}
                        width={previewSWidth + 8}
                        height={previewSHeight + 8}
                        fill="transparent"
                      />

                      {/* Seat representation */}
                      <Rect
                        x={-previewSWidth / 2}
                        y={-previewSHeight / 2}
                        width={previewSWidth}
                        height={previewSHeight}
                        fill={seat.color || seatColor}
                        stroke={isSelected ? "#0284c7" : "#475569"}
                        strokeWidth={isSelected ? 2 : 1}
                        cornerRadius={3}
                        shadowColor={isSelected ? "#0284c7" : "black"}
                        shadowBlur={isSelected ? 4 : 2}
                        shadowOpacity={0.15}
                      />
                      
                      {/* Backrest representation */}
                      <Rect
                        x={-previewSWidth / 2}
                        y={-previewSHeight / 2}
                        width={previewSWidth * 0.15}
                        height={previewSHeight}
                        fill="#334155"
                        cornerRadius={1.5}
                        opacity={0.8}
                      />

                      {/* Seat index tag */}
                      <Text
                        x={-previewSWidth / 2}
                        y={-6}
                        width={previewSWidth}
                        text={(i + 1).toString()}
                        fontSize={10}
                        align="center"
                        fill={seat.color === '#ffffff' ? '#475569' : '#ffffff'}
                        fontStyle="bold"
                      />
                    </Group>
                  );
                })}

                {/* Kund Outer Rim */}
                <Rect
                  x={-previewSize / 2}
                  y={-previewSize / 2}
                  width={previewSize}
                  height={previewSize}
                  fill={kundColor}
                  stroke="#b45309"
                  strokeWidth={2}
                  shadowColor="black"
                  shadowBlur={6}
                  shadowOpacity={0.15}
                />

                {/* Kund Inner Step */}
                <Rect
                  x={-previewSize / 3}
                  y={-previewSize / 3}
                  width={previewSize * (2 / 3)}
                  height={previewSize * (2 / 3)}
                  fill={kundInnerColor}
                  stroke="#b45309"
                  strokeWidth={1}
                />

                {/* Accessories Rendering */}
                {accessories.map((acc) => {
                  const ax = acc.offsetX * previewPxPerMeter;
                  const ay = acc.offsetY * previewPxPerMeter;
                  const aw = acc.width * previewPxPerMeter;
                  const ah = acc.height * previewPxPerMeter;

                  return (
                    <Group
                      key={acc.id}
                      x={ax}
                      y={ay}
                      draggable
                      onDragEnd={(e) => {
                        handleAccessoryDragEnd(acc.id, e.target.x(), e.target.y());
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                    >
                      {acc.type === 'circle' ? (
                        <Circle
                          x={0}
                          y={0}
                          radius={aw / 2}
                          fill={acc.color}
                          stroke="#475569"
                          strokeWidth={1}
                        />
                      ) : acc.type === 'text' ? (
                        <Text
                          x={-aw / 2}
                          y={-ah / 2}
                          width={aw}
                          height={ah}
                          text={acc.name}
                          fontSize={9}
                          align="center"
                          verticalAlign="middle"
                          fill={acc.color}
                          fontStyle="bold"
                        />
                      ) : (
                        <Rect
                          x={-aw / 2}
                          y={-ah / 2}
                          width={aw}
                          height={ah}
                          fill={acc.color}
                          stroke="#475569"
                          strokeWidth={1}
                          cornerRadius={2}
                        />
                      )}
                    </Group>
                  );
                })}

                {/* Main Label representing central Kund text */}
                <Text
                  text="KUND"
                  fontSize={previewSize * 0.22}
                  fontStyle="bold"
                  fill="#78350f"
                  align="center"
                  verticalAlign="middle"
                  width={previewSize}
                  height={previewSize}
                  x={-previewSize / 2}
                  y={-previewSize / 2}
                />
              </Group>
            </Layer>
          </Stage>
        </div>

        {/* Quick dimension guidelines underneath preview */}
        <div className="mt-4 flex space-x-6 text-xs text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <div>
            <span className="font-medium text-slate-700">Inner Kund Size:</span> {kundSize.toFixed(2)}m
          </div>
          <div className="text-slate-300">|</div>
          <div>
            <span className="font-medium text-slate-700">Seat Offset:</span> {seatOffset.toFixed(2)}m
          </div>
          <div className="text-slate-300">|</div>
          <div>
            <span className="font-medium text-slate-700">Total Bound Footprint:</span> {totalFootprintSize.toFixed(2)}m
          </div>
        </div>
      </div>
    </div>
  );
}
