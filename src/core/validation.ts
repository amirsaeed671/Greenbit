export function validateHabitThresholds(minimum: number, target: number, stretch: number): Partial<Record<'minimum' | 'target' | 'stretch', string>> {
  const errors: Partial<Record<'minimum' | 'target' | 'stretch', string>> = {};
  if (!(minimum > 0)) errors.minimum = 'Minimum must be greater than 0.';
  if (!(target >= minimum)) errors.target = 'Target must be at least the minimum.';
  if (!(stretch >= target)) errors.stretch = 'Stretch must be at least the target.';
  return errors;
}
