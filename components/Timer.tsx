// src/components/Timer.tsx
import React, { useRef, useEffect } from "react";

interface TimerProps {
  time: number; // Time in seconds
}

// Helper function to format the time into MM:SS
const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const Timer: React.FC<TimerProps> = ({ time }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      console.log(
        `%c[Timer] Rendered size: ${ref.current.offsetHeight}px`,
        "color: #e67e22"
      );
    }
  });

  return (
    <div
      ref={ref}
      className="text-lg font-mono text-gray-700 bg-white px-3 py-1 rounded-md shadow-sm border"
    >
      {formatTime(time)}
    </div>
  );
};

export default Timer;
