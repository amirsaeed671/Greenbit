export type FlowerShape = 'daisy' | 'tulip' | 'sun' | 'spike' | 'berry' | 'fern' | 'cactus';

export interface PlantSpecies {
  id: string;
  name: string;
  leaf: string;
  flower: string;
  center: string;
  shape: FlowerShape;
}

export const PLANTS: PlantSpecies[] = [
  { id: 'daisy', name: 'Daisy', leaf: '#4E9F5D', flower: '#FFFFFF', center: '#F4BE4F', shape: 'daisy' },
  { id: 'tulip', name: 'Tulip', leaf: '#3F9A62', flower: '#E9708A', center: '#C94D6B', shape: 'tulip' },
  { id: 'sunflower', name: 'Sunflower', leaf: '#4C9A3F', flower: '#F6C342', center: '#7A4E2D', shape: 'sun' },
  { id: 'lavender', name: 'Lavender', leaf: '#6E9C77', flower: '#9B82D6', center: '#7D63C2', shape: 'spike' },
  { id: 'fern', name: 'Fern', leaf: '#3E8E57', flower: '#7CC48F', center: '#3E8E57', shape: 'fern' },
  { id: 'cactus', name: 'Cactus', leaf: '#5DA271', flower: '#F28FA6', center: '#F6C342', shape: 'cactus' },
  { id: 'berry', name: 'Berry bush', leaf: '#3F8F5A', flower: '#D2495E', center: '#8F2D3F', shape: 'berry' },
];

export const plantById = (id: string) => PLANTS.find((p) => p.id === id) ?? PLANTS[0];
