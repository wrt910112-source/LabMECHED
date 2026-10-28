// Illustrative proportions from the supplied front-view photograph.
// +Z faces the operator. Keep the rear probes, cups and motor in place.
export const iseFrontInset = 0.25;
export const iseCabinetFront = 0.75;
export const reagentZ = (original: number) => original - iseFrontInset;
export const iseDiagZ = 0.506 - iseFrontInset;
