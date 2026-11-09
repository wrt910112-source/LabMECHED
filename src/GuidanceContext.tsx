import { createContext, useContext } from "react";
export const GuidanceContext = createContext(true);
export const useGuidance = () => useContext(GuidanceContext);
