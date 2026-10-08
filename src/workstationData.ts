export const mainMenu = [
  "Start Condition",
  "Reagent Management",
  "Analyzer Maintenance",
  "Rack Requisition",
  "Sample Manager",
];
export const maintenancePages = [
  "Analyzer Maintenance",
  "ISE Maintenance",
  "PRO Service",
  "Load Reagent Parameters",
];
export const analyzerTabs = ["Maintenance", "Consumption", "Photocal Monitor"];
export const iseTabs = [
  "Maintenance",
  "Calibration",
  "Slope Chart",
  "Selectivity Check",
];
export const analyzerActions: Array<[string | null, string | null]> = [
  ["Replace Sample Probe", "Replace Sample Syringe"],
  ["Replace Reagent Probe", "Replace Reagent Syringe"],
  ["Replace Wash Syringe", "Clean Wash Well"],
  ["Cleaning Probe", "Prime Washing Line"],
  ["Replace Wash Nozzle", "Replace Mix Bar"],
  ["Prime Wash Nozzle", "Replace Cuvette"],
  ["Inspect Probe & Mixing Bar", null],
];
export const iseActions: Array<[string | null, string | null]> = [
  ["Replace Sample Probe", "Total Prime"],
  ["Replace Sample Syringe", "Prime Bypass"],
  ["Replace Wash Syringe", "Buffer Prime"],
  ["Clean Wash Well", "MID/REF Prime"],
  [null, "Drain Flowcell"],
  [null, "Drain Bypass"],
];
export const analyzerFooter = [
  "Maintenance Edit",
  "Maintenance History",
  "Grid Display",
  "Stand By",
  "W1",
  "W2",
  "Photocal",
  "Print",
];
export const iseFooter = [
  "Maintenance Edit",
  "Maintenance History",
  "Grid Display",
  "Print",
];
// Visible labels transcribed from supplied photographs. Dates and live results are not inferred.
export const analyzerRows: Array<[string, string]> = [
  ["Inspect the Sample Syringes for Leaks", "Daily"],
  ["Inspect the Reagent Syringes for Leaks", "Daily"],
  ["Inspect the Wash Syringes for Leaks", "Daily"],
  ["Inspect, Clean, and Prime the Sample Probes", "Daily"],
  ["Inspect, Clean, and Prime the Reagent Probes", "Daily"],
  ["Inspect and Clean the Mix Bars", "Daily"],
  ["Inspect the Printer and Paper", "Daily"],
  ["Clean the Sample Probes", "Weekly"],
  ["Clean the Mix Bars", "Weekly"],
  ["Perform a W2", "Weekly"],
  ["Perform a Photocal", "Weekly"],
  ["Clean the Pre-dilution Bottles", "Weekly"],
  ["Clean the Sample Probe Wash Wells", "Monthly"],
  ["Clean the Reagent Probe Wash Wells", "Monthly"],
  ["Clean the Mix Bar Wash Wells", "Monthly"],
];
export const iseRows: Array<[string, string]> = [
  ["Inspect the ISE Sample Syringe for Leaks", "Daily"],
  ["Inspect the ISE Wash Syringe for Leaks", "Daily"],
  ["Inspect the ISE Buffer Syringes for Leaks", "Daily"],
  ["Inspect, Clean, and Prime the ISE Sample Probe", "Daily"],
  ["Clean the ISE", "Daily"],
  ["Serum Calibration", "Daily"],
  ["Urine Calibration", "Daily"],
  ["Selectivity Check for the Na and K Electrodes", "Weekly"],
  ["Enhanced Cleaning of Electrode Line", "Weekly"],
  ["Clean the ISE Sample Probe", "Weekly"],
  ["Manually Clean the ISE Mix Bar and Liquid Level Sensors", "2Weeks"],
  ["Clean Sample Pot", "2Weeks"],
  ["Clean the Sample Probe Wash Well", "Monthly"],
  ["Inspect and Add ISE Internal Reference Solution", "2Months"],
  ["ISE Enhanced Cleaning (Manual)", "3Months"],
];
