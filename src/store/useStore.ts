import { create } from 'zustand';
import { AppState, MaterialRequirement, Yagna, MapObject } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

export const useStore = create<AppState>((set, get) => ({
  yagnas: [],
  currentYagnaId: null,
  user: null,
  materials: [
    { id: '1', name: 'Ghee', quantityPerKund: 0.5, unit: 'kg' },
    { id: '2', name: 'Samagri Mix', quantityPerKund: 2, unit: 'kg' },
    { id: '3', name: 'Wood (Samidha)', quantityPerKund: 5, unit: 'kg' },
    { id: '4', name: 'Camphor', quantityPerKund: 50, unit: 'grams' },
  ],
  setUser: (user) => set({ user }),
  setYagnas: (yagnas) => set({ yagnas }),
  setCurrentYagna: (id) => set({ currentYagnaId: id }),
  updateYagna: async (id, updates) => {
    const isGlobalSync = updates.settings !== undefined || updates.materials !== undefined;
    
    // Optimistic update
    set((state) => {
      if (isGlobalSync) {
        return {
          yagnas: state.yagnas.map(y => ({ 
            ...y, 
            ...(y.id === id ? updates : {}), 
            ...(updates.settings ? { settings: updates.settings } : {}),
            ...(updates.materials ? { materials: updates.materials } : {}),
            updatedAt: Date.now() 
          }))
        };
      }
      return {
        yagnas: state.yagnas.map(y => y.id === id ? { ...y, ...updates, updatedAt: Date.now() } : y)
      };
    });
    
    // Firestore sync
    const user = get().user;
    if (user) {
      if (isGlobalSync) {
         const state = get();
         const updatesToSync = state.yagnas.map(y => {
            const yagnaRef = doc(db, 'yagnas', y.id);
            return setDoc(yagnaRef, { 
              ...(y.id === id ? updates : {}), 
              ...(updates.settings ? { settings: updates.settings } : {}),
              ...(updates.materials ? { materials: updates.materials } : {}),
              ownerId: user.uid, 
              updatedAt: Date.now() 
            }, { merge: true });
         });
         await Promise.all(updatesToSync);
      } else {
        const yagnaRef = doc(db, 'yagnas', id);
        await setDoc(yagnaRef, { ...updates, ownerId: user.uid, updatedAt: Date.now() }, { merge: true });
      }
    }
  },
  updateKunds: async (yagnaId, kunds) => {
    set((state) => ({
      yagnas: state.yagnas.map(y => y.id === yagnaId ? { ...y, kunds, updatedAt: Date.now() } : y)
    }));
    
    const user = get().user;
    if (user) {
      const yagnaRef = doc(db, 'yagnas', yagnaId);
      await setDoc(yagnaRef, { kunds, ownerId: user.uid, updatedAt: Date.now() }, { merge: true });
    }
  },
  updateObjects: async (yagnaId, objects) => {
    set((state) => ({
      yagnas: state.yagnas.map(y => y.id === yagnaId ? { ...y, objects, updatedAt: Date.now() } : y)
    }));
    
    const user = get().user;
    if (user) {
      const yagnaRef = doc(db, 'yagnas', yagnaId);
      await setDoc(yagnaRef, { objects, ownerId: user.uid, updatedAt: Date.now() }, { merge: true });
    }
  },
  addYagna: async (yagna) => {
    const user = get().user;
    const yagnaWithOwner = { ...yagna, ownerId: user?.uid || '' };
    
    set((state) => ({ yagnas: [...state.yagnas, yagnaWithOwner] }));
    
    if (user) {
      const yagnaRef = doc(db, 'yagnas', yagna.id);
      await setDoc(yagnaRef, yagnaWithOwner);
    }
  },
  deleteYagna: async (id) => {
    set((state) => ({ 
      yagnas: state.yagnas.filter(y => y.id !== id),
      currentYagnaId: state.currentYagnaId === id ? null : state.currentYagnaId
    }));
    
    const user = get().user;
    if (user) {
      await deleteDoc(doc(db, 'yagnas', id));
    }
  },
  setMaterials: (materials) => set({ materials }),
  updateMaterial: (id, updates) => set((state) => ({
    materials: state.materials.map(m => m.id === id ? { ...m, ...updates } : m)
  })),
  addMaterial: (material) => set((state) => ({
    materials: [...state.materials, material]
  })),
  deleteMaterial: (id) => set((state) => ({
    materials: state.materials.filter(m => m.id !== id)
  }))
}));

// Setup Firebase Listeners for a specific user ID
export function setupFirebaseSync(userId: string) {
  const yagnasQuery = query(collection(db, 'yagnas'), where('ownerId', '==', userId));
  
  const unsubscribe = onSnapshot(yagnasQuery, (snapshot) => {
    const yagnas: Yagna[] = [];
    snapshot.forEach((doc) => {
      yagnas.push(doc.data() as Yagna);
    });
    useStore.getState().setYagnas(yagnas);
  }, (error) => {
    console.error("Firestore sync error:", error);
  });

  return unsubscribe;
}
