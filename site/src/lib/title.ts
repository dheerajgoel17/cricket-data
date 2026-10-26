import { useEffect } from "react";

/** Sets the document title (one call per page render is fine). */
export function setTitle(t: string) { if (typeof document !== "undefined") document.title = `${t} | Cricket Props Hub`; }
export const useTitle = (t: string) => useEffect(() => { document.title = `${t} | Cricket Props Hub`; }, [t]);
