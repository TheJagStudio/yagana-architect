import { User } from 'firebase/auth';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapObject {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  points?: number[]; // [x1, y1, x2, y2, ...]
}

export interface Yagna {
  id: string;
  name: string;
  date: string;
  dimensions: { width: number; height: number }; // In meters or feet
  location: LatLng | null;
  polygon: LatLng[]; // Points forming the polygon
  settings: YagnaSettings;
  kunds: Kund[];
  objects: MapObject[];
  ownerId?: string;
  materials?: MaterialRequirement[];
  hidden?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface KundAccessory {
  id: string;
  name: string;
  type: 'rect' | 'circle' | 'text';
  offsetX: number; // offset in meters from Kund center
  offsetY: number; // offset in meters from Kund center
  width: number;   // in meters
  height: number;  // in meters
  color: string;
}

export interface IndividualSeat {
  id: string;
  offsetX: number; // offset in meters from Kund center
  offsetY: number; // offset in meters from Kund center
  rotation: number; // in degrees
  color?: string; // optional color override
}

export interface YagnaSettings {
  kundSize: number; // side length in meters
  padding: number; // distance between kunds
  sitsPerKund: number;
  targetKundCount: number;
  kundDirection: number;
  unit: 'meters' | 'feet';
  canvasPadding?: number; // padding inside polygon bounds
  kundColor?: string;
  kundInnerColor?: string;
  seatColor?: string;
  seatWidth?: number; // in meters
  seatHeight?: number; // in meters
  seatOffset?: number; // distance from Kund outer edge to seat inner edge in meters
  seatLayout?: 'circular' | 'square';
  kundAccessories?: KundAccessory[];
  individualSeats?: IndividualSeat[];
  groundOpacity?: number; // opacity of main area ground polygon, 0 to 1
  layoutType?: 'grid' | 'circular';
  mainKundSize?: number; // side length of the central main kund in circular layout
}

export interface Kund {
  id: string;
  x: number;
  y: number;
  rotation: number;
  number: number;
  assignedTo: string | null;
  seats?: number;
  size?: number;
}

export interface MaterialRequirement {
  id: string;
  name: string;
  quantityPerKund: number;
  unit: string;
}

export interface AppState {
  yagnas: Yagna[];
  currentYagnaId: string | null;
  materials: MaterialRequirement[];
  user: User | null;
  setUser: (user: User | null) => void;
  setYagnas: (yagnas: Yagna[]) => void;
  setCurrentYagna: (id: string | null) => void;
  updateYagna: (id: string, updates: Partial<Yagna>) => void;
  updateKunds: (yagnaId: string, kunds: Kund[]) => void;
  updateObjects: (yagnaId: string, objects: MapObject[]) => void;
  addYagna: (yagna: Yagna) => void;
  deleteYagna: (id: string) => void;
  setMaterials: (materials: MaterialRequirement[]) => void;
  updateMaterial: (id: string, updates: Partial<MaterialRequirement>) => void;
  addMaterial: (material: MaterialRequirement) => void;
  deleteMaterial: (id: string) => void;
}
