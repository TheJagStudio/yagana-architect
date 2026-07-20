import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Yagna } from '../types';
import KundCanvas from './KundCanvas';
import MapSelector from './MapSelector';
import KundEditor from './KundEditor';
import { generateAutoLayout } from '../lib/layoutUtils';
import { Download, LayoutGrid, Map as MapIcon, Settings, Users, Trash2, Sparkles, Plus, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Workspace({ yagna }: { yagna: Yagna }) {
  const [activeTab, setActiveTab] = useState<'canvas' | 'settings' | 'materials' | 'kund-editor'>('canvas');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const stageRef = useRef<any>(null);
  const updateYagna = useStore(state => state.updateYagna);
  const updateKunds = useStore(state => state.updateKunds);
  const globalMaterials = useStore(state => state.materials);
  const materials = yagna.materials || globalMaterials;

  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<number | ''>('');
  const [newItemUnit, setNewItemUnit] = useState('kg');

  const handleUpdateMaterial = (id: string, updates: Partial<typeof materials[0]>) => {
    const updated = materials.map(m => m.id === id ? { ...m, ...updates } : m);
    updateYagna(yagna.id, { materials: updated });
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemQty === '' || newItemQty <= 0) return;
    const newMat = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      quantityPerKund: Number(newItemQty),
      unit: newItemUnit
    };
    updateYagna(yagna.id, { materials: [...materials, newMat] });
    setNewItemName('');
    setNewItemQty('');
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = materials.filter(m => m.id !== id);
    updateYagna(yagna.id, { materials: updated });
  };

  const handleResetMaterials = () => {
    const defaultMaterials = [
      { id: '1', name: 'Ghee', quantityPerKund: 0.5, unit: 'kg' },
      { id: '2', name: 'Samagri Mix', quantityPerKund: 2, unit: 'kg' },
      { id: '3', name: 'Wood (Samidha)', quantityPerKund: 5, unit: 'kg' },
      { id: '4', name: 'Camphor', quantityPerKund: 50, unit: 'grams' },
    ];
    updateYagna(yagna.id, { materials: defaultMaterials });
  };

  const updateObjects = useStore(state => state.updateObjects);

  const handleClearCanvas = () => {
    setShowClearConfirm(true);
  };

  const handleAutoArrange = () => {
    const count = yagna.settings.targetKundCount;
    if (count > 0) {
      const newKunds = generateAutoLayout(yagna);
      updateKunds(yagna.id, newKunds);
    }
  };

  const addCustomObject = () => {
    const newObj = {
      id: crypto.randomUUID(),
      type: 'stage',
      name: 'Main Stage',
      x: 0,
      y: 0,
      width: 100, // 2 meters * pxPerMeter (50)
      height: 100,
      rotation: 0,
      color: '#ec4899' // pink default
    };
    updateObjects(yagna.id, [...(yagna.objects || []), newObj]);
  };

  const exportPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Draw Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.text("Yagna Layout & Event Report", 15, 20);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 15, 26);

    // Separator line
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.setLineWidth(0.5);
    pdf.line(15, 30, 195, 30);

    // Details grid
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(51, 65, 85); // slate-700
    pdf.text("Event Details:", 15, 40);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    pdf.text(`Yagna Name: ${yagna.name}`, 15, 47);
    pdf.text(`Event Location: ${yagna.location ? `${yagna.location.lat.toFixed(6)}, ${yagna.location.lng.toFixed(6)}` : 'Custom Location'}`, 15, 53);
    pdf.text(`Ground Area: ${yagna.dimensions.width}m x ${yagna.dimensions.height}m`, 15, 59);

    pdf.text(`Total Kunds: ${yagna.kunds.length} / ${yagna.settings.targetKundCount}`, 110, 47);
    pdf.text(`Total Participants: ${totalParticipants}`, 110, 53);
    pdf.text(`Seats Per Kund: ${yagna.settings.sitsPerKund}`, 110, 59);

    // Separator
    pdf.setDrawColor(226, 232, 240);
    pdf.line(15, 65, 195, 65);

    // Add Layout Diagram Section
    pdf.setFont("helvetica", "bold");
    pdf.text("Layout Diagram / Map:", 15, 75);

    let nextY = 80;

    // Get stage image!
    if (stageRef.current) {
      try {
        const stageDataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
        const imgWidth = 180;
        const imgHeight = 110; 
        pdf.addImage(stageDataUrl, 'PNG', 15, 80, imgWidth, imgHeight);
        
        // Draw a border around the map
        pdf.setDrawColor(203, 213, 225); // slate-300
        pdf.rect(15, 80, imgWidth, imgHeight, "S");
        nextY = 195;
      } catch (err) {
        console.error("Error capturing stage:", err);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(148, 163, 184);
        pdf.text("(Layout image could not be rendered because of canvas security restrictions)", 15, 85);
        nextY = 95;
      }
    } else {
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(148, 163, 184);
      pdf.text("(Layout canvas was not initialized or not found)", 15, 85);
      nextY = 95;
    }

    // Materials Section
    pdf.setDrawColor(226, 232, 240);
    pdf.line(15, nextY, 195, nextY);
    
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(11);
    pdf.text("Material Estimates & Summary:", 15, nextY + 10);

    // Draw table headers
    pdf.setFontSize(9);
    pdf.setFillColor(248, 250, 252); // slate-50
    pdf.rect(15, nextY + 16, 180, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text("Material Name", 18, nextY + 21);
    pdf.text("Qty Per Kund", 110, nextY + 21);
    pdf.text("Total Required", 155, nextY + 21);

    // Table rows
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    let yOffset = nextY + 29;
    materials.forEach((m) => {
      if (yOffset > 275) {
        // page overflow, add page
        pdf.addPage();
        yOffset = 20;
      }
      pdf.text(m.name, 18, yOffset);
      pdf.text(`${m.quantityPerKund} ${m.unit}`, 110, yOffset);
      pdf.text(`${(m.quantityPerKund * yagna.kunds.length).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${m.unit}`, 155, yOffset);
      
      // row separator line
      pdf.setDrawColor(241, 245, 249);
      pdf.line(15, yOffset + 3, 195, yOffset + 3);
      yOffset += 8;
    });

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text("Generated by Yagna Architect Layout Planner", 105, 288, { align: "center" });

    pdf.save(`Yagna_Layout_Report_${yagna.name.replace(/\s+/g, '_')}.pdf`);
  };

  const totalParticipants = yagna.kunds.reduce((acc, k) => acc + (k.seats || yagna.settings.sitsPerKund), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800">{yagna.name}</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'canvas' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Layout Design
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'materials' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Materials & Samagri
          </button>
          <button
            onClick={() => setActiveTab('kund-editor')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'kund-editor' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Kund Shape Editor</span>
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className={`h-full w-full flex flex-col ${activeTab === 'canvas' ? '' : 'hidden'}`}>
          <div className="p-4 flex items-center space-x-4 bg-slate-50 border-b border-slate-200">
            <button
              onClick={handleAutoArrange}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Auto Arrange Kunds</span>
            </button>
            <button
              onClick={addCustomObject}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Object</span>
            </button>
            <button
              onClick={handleClearCanvas}
              className="flex items-center space-x-2 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-md text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Canvas</span>
            </button>
            <div className="text-sm text-slate-500">
              Total Kunds: {yagna.kunds.length} / {yagna.settings.targetKundCount} | Participants: {totalParticipants}
            </div>
          </div>
          <div className="flex-1 p-4 min-h-0 min-w-0 flex flex-col">
            <KundCanvas yagna={yagna} stageRefCallback={(stage) => { stageRef.current = stage; }} />
          </div>
        </div>

        {activeTab === 'settings' && (
          <div className="p-8 max-w-2xl mx-auto overflow-y-auto h-full">
            <h3 className="text-lg font-medium text-slate-900 mb-6 flex items-center"><Settings className="w-5 h-5 mr-2"/> General Settings</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yagna Name</label>
                <input
                  type="text"
                  value={yagna.name}
                  onChange={(e) => updateYagna(yagna.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Area Width (meters)</label>
                  <input
                    type="number"
                    value={yagna.dimensions.width}
                    onChange={(e) => updateYagna(yagna.id, { dimensions: { ...yagna.dimensions, width: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Area Height (meters)</label>
                  <input
                    type="number"
                    value={yagna.dimensions.height}
                    onChange={(e) => updateYagna(yagna.id, { dimensions: { ...yagna.dimensions, height: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location on Map</label>
                <MapSelector yagna={yagna} />
              </div>

              <h3 className="text-lg font-medium text-slate-900 mt-8 mb-4 border-b pb-2">Kund Parameters</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Layout Type</label>
                  <select
                    value={yagna.settings.layoutType || 'grid'}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, layoutType: e.target.value as 'grid' | 'circular' } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="grid">Grid Layout</option>
                    <option value="circular">Circular Layout</option>
                  </select>
                </div>
                {yagna.settings.layoutType === 'circular' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Main Kund Size (meters)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={yagna.settings.mainKundSize || yagna.settings.kundSize * 1.5}
                      onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, mainKundSize: Number(e.target.value) } })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Kund Count</label>
                  <input
                    type="number"
                    value={yagna.settings.targetKundCount || 11}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, targetKundCount: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kund Direction (Degrees)</label>
                  <input
                    type="number"
                    value={yagna.settings.kundDirection || 0}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, kundDirection: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kund Size (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yagna.settings.kundSize}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, kundSize: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Padding Between Kunds (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={yagna.settings.padding}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, padding: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Seats per Kund</label>
                  <input
                    type="number"
                    value={yagna.settings.sitsPerKund}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, sitsPerKund: Number(e.target.value) } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Canvas Padding (meters)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={yagna.settings.canvasPadding || 0}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, canvasPadding: Number(e.target.value) || 0 } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="col-span-2 border-t border-slate-150 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Main Area Opacity</label>
                    <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                      {Math.round((yagna.settings.groundOpacity !== undefined ? yagna.settings.groundOpacity : 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={yagna.settings.groundOpacity !== undefined ? yagna.settings.groundOpacity : 1.0}
                    onChange={(e) => updateYagna(yagna.id, { settings: { ...yagna.settings, groundOpacity: parseFloat(e.target.value) } })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Adjust transparency of the background boundary polygon/rectangle. Useful for seeing underlying maps clearly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Material Estimates</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Adjust material requirements per Kund. Changes are saved automatically.
                </p>
              </div>
              <button
                onClick={handleResetMaterials}
                className="self-start flex items-center space-x-1 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md text-xs font-medium transition-all"
                title="Reset to default estimates"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Kunds</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{yagna.kunds.length}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Expected Participants</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{totalParticipants}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Items Tracked</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{materials.length}</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/70 text-slate-600">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Item Name</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider w-56">Per Kund Quantity</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider w-40">Total Required</th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleUpdateMaterial(m.id, { name: e.target.value })}
                          className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-slate-400 rounded px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none transition-all"
                          placeholder="Material Name"
                        />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={m.quantityPerKund}
                            onChange={(e) => handleUpdateMaterial(m.id, { quantityPerKund: parseFloat(e.target.value) || 0 })}
                            className="w-24 px-2 py-1 border border-slate-200 hover:border-slate-300 focus:border-slate-500 rounded-md text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors"
                          />
                          <select
                            value={m.unit}
                            onChange={(e) => handleUpdateMaterial(m.id, { unit: e.target.value })}
                            className="px-2 py-1 border border-slate-200 hover:border-slate-300 focus:border-slate-500 rounded-md text-sm text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-slate-950 transition-colors cursor-pointer"
                          >
                            <option value="kg">kg</option>
                            <option value="grams">grams</option>
                            <option value="pieces">pieces</option>
                            <option value="liters">liters</option>
                            <option value="bundles">bundles</option>
                            <option value="packets">packets</option>
                            <option value="meters">meters</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-slate-800">
                        {(m.quantityPerKund * yagna.kunds.length).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {m.unit}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                        <button
                          onClick={() => handleDeleteMaterial(m.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={`Delete ${m.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                        No materials tracked. Use the form below to add some!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Material Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-slate-600" />
                <span>Add Custom Material Requirement</span>
              </h4>
              <form onSubmit={handleAddMaterial} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Item Name</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Mango Wood (Extra)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-950 transition-shadow"
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Qty per Kund</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-950 transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Unit</label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-950 transition-shadow cursor-pointer"
                    >
                      <option value="kg">kg</option>
                      <option value="grams">grams</option>
                      <option value="pieces">pieces</option>
                      <option value="liters">liters</option>
                      <option value="bundles">bundles</option>
                      <option value="packets">packets</option>
                      <option value="meters">meters</option>
                    </select>
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-950 text-white hover:bg-slate-800 text-sm font-medium rounded-md transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Estimates</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'kund-editor' && (
          <KundEditor yagna={yagna} />
        )}
      </div>

      {/* Hidden container for PDF Generation */}
      <div id="report-container" className="hidden fixed top-0 left-0 bg-white p-10 w-[800px] text-slate-900 z-[-10]">
        <h1 className="text-3xl font-bold mb-4">{yagna.name} - Yagna Event Report</h1>
        <p className="mb-2"><strong>Total Kunds:</strong> {yagna.kunds.length}</p>
        <p className="mb-2"><strong>Total Participants:</strong> {totalParticipants}</p>
        <p className="mb-6"><strong>Area Dimensions:</strong> {yagna.dimensions.width}m x {yagna.dimensions.height}m</p>

        <h2 className="text-xl font-bold mt-8 mb-4 border-b pb-2">Material Requirements</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="border-b-2 py-2">Material</th>
              <th className="border-b-2 py-2">Total Quantity</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id}>
                <td className="border-b py-2">{m.name}</td>
                <td className="border-b py-2">{(m.quantityPerKund * yagna.kunds.length).toFixed(1)} {m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <p className="mt-12 text-sm text-slate-500 text-center">Generated by Yagna Architect</p>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-md w-full p-6 m-4 animate-scale-up">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Clear Canvas</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to clear all kunds and custom objects from the canvas? This action cannot be undone.
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateKunds(yagna.id, []);
                  updateObjects(yagna.id, []);
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Yes, Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
