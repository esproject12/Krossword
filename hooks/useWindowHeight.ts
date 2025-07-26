// src/hooks/useWindowHeight.ts
import { useState, useLayoutEffect } from "react";

// This is a custom hook to get the real-time window height.
export const useWindowHeight = () => {
  // 1. State to store the height value. Initialize to 0.
  const [height, setHeight] = useState(0);

  // 2. useLayoutEffect runs after the DOM is built but before the screen is painted.
  useLayoutEffect(() => {
    // 3. This function measures the window's inner height and updates our state.
    function handleResize() {
      const newHeight = window.innerHeight;
      console.log(
        `[useWindowHeight] Event Fired. New innerHeight: ${newHeight}px`
      );
      setHeight(newHeight);
    }

    console.log("[useWindowHeight] Hook mounting. Adding event listener.");
    // 4. Add an event listener to re-run the measurement whenever the window is resized.
    window.addEventListener("resize", handleResize);

    // 5. Call it once immediately to get the initial size.
    handleResize();

    // 6. Cleanup function: remove the listener when the component unmounts to prevent memory leaks.
    return () => {
      console.log(
        "[useWindowHeight] Hook unmounting. Removing event listener."
      );
      window.removeEventListener("resize", handleResize);
    };
  }, []); // The empty array [] means this effect runs only once when the component first mounts.

  // 7. Return the current height value.
  return height;
};
