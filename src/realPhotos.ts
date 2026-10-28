import type { Part, PartId } from "./data";
import { slotById } from "./detergents";

// Keep the supplied filenames: they are also the visible source captions.
const photo = (filename: string) => `real-photos/${filename}`;
export const partPhotoFiles: Partial<Record<PartId, string[]>> = {
  ise: ["ISE module.jpg", "ISE probe.jpg", "ISE module (上方開啟).jpg"],
  "ise-cups": ["ISE cups.jpg"],
  "ise-reagents": ["ISE standard, buffer.jpg", "ISE reference.jpg"],
  "ise-reference": ["ISE reference.jpg"],
  "ise-internal": [
    "ISE module (上方開啟).jpg",
    "ISE module mixing cup, T型管.jpg",
    "ISE module 馬達 (拆卸).jpg",
    "ISE module.jpg",
  ],
  "ise-mixing-cup": [
    "ISE module mixing cup, T型管.jpg",
    "ISE module (上方開啟).jpg",
  ],
  "ise-t-tube": [
    "ISE module mixing cup, T型管.jpg",
    "ISE module (上方開啟).jpg",
  ],
  "ise-motor": ["ISE module 馬達 (拆卸).jpg", "ISE module (上方開啟).jpg"],
  "ise-plug-a": ["ISE module 馬達 (拆卸).jpg", "ISE module (上方開啟).jpg"],
  "ise-plug-b": ["ISE module 馬達 (拆卸).jpg", "ISE module (上方開啟).jpg"],
  analyzer: ["試劑冰箱 (分析單元).jpg"],
  r1: ["R1左側.jpg", "R1右側.jpg", "試劑冰箱 (分析單元).jpg"],
  r2: ["R2左側.jpg", "R2右側.jpg", "試劑冰箱 (分析單元).jpg"],
  sample: ["Sample probes.jpg", "Sample probe DET1, DET2.jpg"],
  mixing: [
    "mixer bar (右側).jpg",
    "mixer bar (右側)_2.jpg",
    "mixer bar (右側) mixing well.jpg",
    "mixer bar (左側).jpg",
    "mixer bar (左側) mixing well.jpg",
  ],
  syringes: ["前方syringe.jpg"],
  "clean-solution": ["wash solution櫃子.jpg", "wash solution.jpg"],
};
for (const id of Object.keys(partPhotoFiles) as PartId[])
  partPhotoFiles[id] = partPhotoFiles[id]!.map(photo);

export interface PhotoSelection {
  targetId?: string;
  slotId?: string | null;
}
export interface ReferencePhoto {
  file: string;
  context?: boolean;
}
const bankPhotos: Record<string, string> = {
  // Match the printed slot numbers, rather than infer left/right from the camera.
  "r1-inner": "R1左側.jpg", // 57 / 58 / 55
  "r1-outer": "R1右側.jpg", // 59 / 60 / 56
  "r2-outer": "R2左側.jpg", // 57 / 58 / W2
  "r2-inner": "R2右側.jpg", // 55 / 56 / W2
  "sample-left": "Sample probe DET1, DET2.jpg",
  "sample-right": "Sample probe DET1, DET2.jpg",
  "ise-wash": "ISE probe.jpg",
};
const withoutCloseup: PartId[] = ["rear-syringes", "sample-track"];

/** Presentation only: selected geometry chooses photographs, never task state. */
export function referencePhotos(
  part: Part,
  selection: PhotoSelection = {},
): ReferencePhoto[] {
  const exact = (...files: string[]) =>
    files.map((file) => ({ file: photo(file) }));
  const context = (...files: string[]) =>
    exact(...files).map((p) => ({ ...p, context: true }));
  const slot = selection.slotId ? slotById[selection.slotId] : undefined;
  if (slot?.module === part.id && bankPhotos[slot.bankId])
    return exact(bankPhotos[slot.bankId]);

  const target = selection.targetId?.replace(/^(lock|tip)-/, "");
  if (part.id === "ise" && target === "ISE") return exact("ISE probe.jpg");
  if (part.id === "sample" && target?.startsWith("Sample-"))
    return exact("Sample probes.jpg");
  if (
    (part.id === "r1" && /^R1-[12]$/.test(target || "")) ||
    (part.id === "r2" && /^R2-[12]$/.test(target || ""))
  )
    return context("試劑冰箱 (分析單元).jpg");
  if (part.id === "mixing") {
    if (target?.startsWith("well-R1S-"))
      return exact("mixer bar (右側) mixing well.jpg");
    if (target?.startsWith("well-R2-"))
      return exact("mixer bar (左側) mixing well.jpg");
    if (
      target === "右側" ||
      target === "group-R1S" ||
      target?.startsWith("R1S-")
    )
      return exact(
        "mixer bar (右側).jpg",
        "mixer bar (右側)_2.jpg",
        "mixer bar (右側) mixing well.jpg",
      );
    if (target === "左側" || target === "group-R2" || target?.startsWith("R2-"))
      return exact("mixer bar (左側).jpg", "mixer bar (左側) mixing well.jpg");
  }
  return [part.photo, ...(part.extraPhotos || [])].map((file) => ({
    file,
    context: withoutCloseup.includes(part.id),
  }));
}
