// src/hooks/useWindowSize.ts

import { useLayoutEffect } from "react";

export const useWindowSize = (): void => {
  useLayoutEffect(() => {
    console.log("[useWindowSize] Hook is running."); // LOG 1

    const updateSize = () => {
      const newHeight = window.innerHeight;
      console.log(
        `[useWindowSize] updateSize Fired. Measured innerHeight: ${newHeight}px`
      ); // LOG 2

      document.documentElement.style.setProperty(
        "--app-height",
        `${newHeight}px`
      );
    };

    window.addEventListener("resize", updateSize);
    updateSize();

    return () => {
      console.log("[useWindowSize] Cleanup running."); // LOG 3
      window.removeEventListener("resize", updateSize);
    };
  }, []);
};
