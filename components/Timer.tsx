import React from "react";

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
  return (
    <div className="text-xl font-mono text-gray-700 bg-white px-4 py-2 rounded-md shadow-sm border">
      {formatTime(time)}
    </div>
  );
};

export default Timer;
