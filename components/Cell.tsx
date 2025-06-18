import React from "react";
import type { CellCheckState } from "../types";

interface CellProps {
  value: string | null;
  clueNumber?: number;
  isBlackSquare: boolean;
  isActive: boolean;
  isWordActive: boolean;
  checkState: CellCheckState;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefCallback<HTMLInputElement>;
}

const Cell: React.FC<CellProps> = ({
  value,
  clueNumber,
  isBlackSquare,
  isActive,
  isWordActive,
  checkState,
  onChange,
  onFocus,
  onKeyDown,
  inputRef,
}) => {
  if (isBlackSquare) {
    return (
      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gray-800 border border-gray-700"></div>
    );
  }

  let cellBgColor = "bg-white";
  if (isWordActive) cellBgColor = "bg-blue-100";
  if (isActive) cellBgColor = "bg-blue-200";
  if (checkState === "incorrect") cellBgColor = "bg-red-200";
  if (checkState === "correct") cellBgColor = "bg-green-200";

  const baseClasses =
    "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 border border-gray-400 text-gray-800 font-bold text-lg sm:text-xl md:text-2xl flex items-center justify-center relative crossword-cell";
  const ringClass = isActive ? "ring-2 ring-blue-500 z-10" : "";

  return (
    <div
      className={`${baseClasses} ${cellBgColor} ${ringClass}`}
      onClick={onFocus} // Changed to onFocus to trigger cell activation
    >
      {clueNumber && (
        <span className="absolute top-0 left-0.5 text-xs text-gray-600 font-normal select-none pointer-events-none">
          {clueNumber}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        maxLength={1}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className="w-full h-full text-center p-0 m-0 border-0 text-inherit"
        aria-label={`cell input ${clueNumber ? `clue ${clueNumber}` : ""}`}
      />
    </div>
  );
};

export default React.memo(Cell);
