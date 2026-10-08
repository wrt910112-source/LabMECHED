export const tests = [
  "1.ALB",
  "2.ALP",
  "3.ALT",
  "4.AMY",
  "5.AST",
  "6.CA",
  "7.CHOL",
  "8.CK",
  "9.CRE",
  "10.CRPHS",
  "12.DBILC",
  "13.GGT",
  "14.GLUC",
  "15.HDL",
  "16.PHOS",
  "17.IRON",
  "18.LAC",
  "19.LDH",
  "20.LDL",
  "21.LIP",
  "22.MG",
  "24.TBILC",
  "25.TP",
  "26.TG",
  "27.UIBC",
  "28.BUN",
  "29.UA",
  "31.UALB",
  "32.ACTM",
  "33.AMM",
  "35.ASO",
  "37.C3",
  "38.C4",
  "39.CAR",
  "40.ETOH",
  "41.IgA",
  "42.IgG",
  "43.IgM",
  "44.Li",
  "46.PHB",
  "47.PHY",
  "48.PALB",
  "49.RF",
  "50.THE",
  "52.VPA",
  "53.VAN",
  "97.Na",
  "54.CO2",
  "98.K",
  "99.Cl",
  "62.UCSFP",
];
// Figure 7's right-hand list, with group membership clarified by the user.
export const serumQc = tests.filter(
  (id) =>
    ![
      "31.UALB",
      "35.ASO",
      "37.C3",
      "38.C4",
      "41.IgA",
      "42.IgG",
      "43.IgM",
      "48.PALB",
      "49.RF",
      "62.UCSFP",
    ].includes(id),
);
export const masQc = serumQc.filter(
  (id) => !["10.CRPHS", "33.AMM", "40.ETOH", "54.CO2"].includes(id),
);
export const urineQc = [
  "4.AMY",
  "6.CA",
  "9.CRE",
  "14.GLUC",
  "16.PHOS",
  "22.MG",
  "28.BUN",
  "29.UA",
  "31.UALB",
  "62.UCSFP",
  "97.Na",
  "98.K",
  "99.Cl",
];
export type RackSelection = {
  rb: string[];
  cal: string[];
  qc: string[];
  sample: string[];
};
export const emptyRack = (): Record<string, RackSelection> => ({
  Serum: { rb: [], cal: [], qc: [], sample: [] },
  Urine: { rb: [], cal: [], qc: [], sample: [] },
});
export const stabilityWarning = (hours: number | null) =>
  hours !== null && Number.isFinite(hours) && hours < 8;
export const remainingText = (hours: number | null) =>
  hours === null
    ? "—"
    : hours >= 24 && hours % 24 === 0
      ? `${hours / 24}D`
      : `${hours}H`;
export const mainShots = [
  1540, 304, 1172, 67, 702, 971, 2034, 100, 1763, 317, 620, 164, 1705, 240, 207,
  294, 62, 781, 320, 43, 76, 370, 1625, 687, 159, 1174, 212, 0, 0, 118,
];
export const detailRows = [
  ["R1-13", "1.ALB", 1540, 86, 696, 696, "03/01/2027", "2644", "J989", 1],
  ["R1-30", "2.ALP", 304, 3, 240, null, "02/01/2027", "2637", "1189", 1],
  ["R2-47", "2.ALP", 307, 3, 240, null, "02/01/2027", "2637", "1106", 1],
  ["R1-52", "3.ALT", 211, 26, 72, null, "03/01/2028", "2668", "M216", 1],
  ["R2-36", "3.ALT", 250, 26, 72, null, "03/01/2028", "2668", "M178", 1],
  ["R1-2", "3.ALT", 961, 29, 144, null, "03/01/2028", "2668", "M220", 2],
  ["R2-22", "3.ALT", 1000, 29, 144, null, "03/01/2028", "2668", "M174", 2],
  ["R1-49", "4.AMY", 67, 13, 144, null, "01/01/2027", "2631", "0325", 1],
  ["R1-33", "5.AST", 702, 23, 120, null, "04/01/2027", "2619", "3601", 1],
  ["R2-24", "5.AST", 706, 23, 120, null, "04/01/2027", "2619", "3593", 1],
  ["R1-45", "6.CA", 83, 80, 624, null, "02/01/2028", "2583", "5232", 1],
  ["R1-10", "6.CA", 888, 89, 624, 624, "02/01/2028", "2583", "5234", 2],
  ["R1-12", "7.CHOL", 2034, 85, 672, 672, "10/01/2026", "2635", "5228", 1],
  ["R1-28", "8.CK", 123, 23, 552, null, "01/01/2027", "2688", "J562", 1],
  ["R2-40", "8.CK", 100, 23, 552, null, "01/01/2027", "2688", "J342", 1],
  ["R1-27", "9.CRE", 515, 4, 7, 7, "07/01/2028", "2802", "7979", 1],
  ["R2-38", "9.CRE", 464, 4, 7, 7, "07/01/2028", "2802", "8153", 1],
] as const;
