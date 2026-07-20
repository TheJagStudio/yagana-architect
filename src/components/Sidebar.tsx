import { useState } from 'react';
import { useStore } from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Flame, Trash2, Check, X, Eye, EyeOff } from 'lucide-react';
import { Yagna } from '../types';

export default function Sidebar() {
  const yagnas = useStore(state => state.yagnas);
  const currentYagnaId = useStore(state => state.currentYagnaId);
  const setCurrentYagna = useStore(state => state.setCurrentYagna);
  const addYagna = useStore(state => state.addYagna);
  const deleteYagna = useStore(state => state.deleteYagna);
  const updateYagna = useStore(state => state.updateYagna);
  
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    const baseYagna = yagnas.length > 0 ? yagnas[0] : null;
    
    const newYagna: Yagna = {
      id: uuidv4(),
      name: `Mandap ${yagnas.length + 1}`,
      date: new Date().toISOString(),
      dimensions: { width: 50, height: 50 },
      location: null,
      polygon: [],
      settings: baseYagna ? JSON.parse(JSON.stringify(baseYagna.settings)) : {
        kundSize: 1.5,
        padding: 2,
        sitsPerKund: 4,
        targetKundCount: 11,
        kundDirection: 0,
        unit: 'meters'
      },
      materials: baseYagna && baseYagna.materials ? JSON.parse(JSON.stringify(baseYagna.materials)) : [],
      kunds: [],
      objects: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    addYagna(newYagna);
    setCurrentYagna(newYagna.id);
  };

  return (
    <div className="w-64 bg-slate-900 h-full flex flex-col text-slate-300">
      <div className="p-4 flex items-center space-x-3 text-white">
        <Flame className="w-6 h-6 text-orange-500" />
        <h1 className="font-bold text-lg tracking-wide">Yagna Architect</h1>
      </div>
      
      <div className="px-4 py-4 border-b border-slate-800">
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium text-sm">New Project</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Projects</div>
        {yagnas.length === 0 && (
          <div className="text-sm text-slate-500 italic">No projects yet</div>
        )}
        {yagnas.map(yagna => (
          <div
            key={yagna.id}
            className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${currentYagnaId === yagna.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
            onClick={() => {
              if (deletingId !== yagna.id) {
                setCurrentYagna(yagna.id);
              }
            }}
          >
            <span className="truncate text-sm font-medium pr-2 flex-1">{yagna.name}</span>
            {deletingId === yagna.id ? (
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-amber-400 font-medium mr-1">Sure?</span>
                <button
                  onClick={() => {
                    deleteYagna(yagna.id);
                    setDeletingId(null);
                  }}
                  className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                  title="Confirm Delete"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  className="p-1 hover:bg-slate-700 text-slate-400 rounded transition-colors"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateYagna(yagna.id, { hidden: !yagna.hidden });
                  }}
                  className={`p-1 rounded transition-colors ${
                    yagna.hidden 
                      ? 'text-amber-500 hover:text-amber-400 opacity-100' 
                      : 'text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100'
                  }`}
                  title={yagna.hidden ? "Show on Canvas" : "Hide from Canvas"}
                >
                  {yagna.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(yagna.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-opacity"
                  title="Delete Project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
