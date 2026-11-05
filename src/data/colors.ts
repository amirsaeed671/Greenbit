/** Named colours for projects and labels. Each is used next to text, never as text. */
export const PROJECT_COLORS = [
  { id: 'berry', name: 'Berry', hex: '#b8256f' },
  { id: 'red', name: 'Red', hex: '#d1453b' },
  { id: 'orange', name: 'Orange', hex: '#e0861a' },
  { id: 'yellow', name: 'Yellow', hex: '#e7b416' },
  { id: 'olive', name: 'Olive', hex: '#a8b621' },
  { id: 'green', name: 'Green', hex: '#3f9a5a' },
  { id: 'teal', name: 'Teal', hex: '#1c9aa6' },
  { id: 'blue', name: 'Blue', hex: '#3b7ddd' },
  { id: 'violet', name: 'Violet', hex: '#7c5cd6' },
  { id: 'grey', name: 'Grey', hex: '#8a8f8c' },
] as const;

export const colorHex = (id: string) => PROJECT_COLORS.find((c) => c.id === id)?.hex ?? '#8a8f8c';
