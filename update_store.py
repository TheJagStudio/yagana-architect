import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

target = """  updateYagna: async (id, updates) => {
    // Optimistic update
    set((state) => ({
      yagnas: state.yagnas.map(y => y.id === id ? { ...y, ...updates, updatedAt: Date.now() } : y)
    }));
    
    // Firestore sync
    const user = get().user;
    if (user) {
      const yagnaRef = doc(db, 'yagnas', id);
      await setDoc(yagnaRef, { ...updates, ownerId: user.uid, updatedAt: Date.now() }, { merge: true });
    }
  },"""

replacement = """  updateYagna: async (id, updates) => {
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
  },"""

content = content.replace(target, replacement)
with open('src/store/useStore.ts', 'w') as f:
    f.write(content)

print("Updated successfully")
