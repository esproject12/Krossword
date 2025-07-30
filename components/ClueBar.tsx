// src/components/ClueBar.tsx

import React, { useRef, useEffect } from "react";
import type { WordDefinition, Orientation } from "../types";

interface ClueBarProps {
  activeWord: WordDefinition | null;
  activeDirection: Orientation;
  onPrevClue: () => void;
  onNextClue: () => void;
}

const ClueBar: React.FC<ClueBarProps> = ({
  activeWord,
  activeDirection,
  onPrevClue,
  onNextClue,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      console.log(
        `%c[ClueBar] Rendered size: ${ref.current.offsetHeight}px`,
        "color: #e67e22"
      );
    }
  });

  if (!activeWord) {
    return (
      <div
        ref={ref}
        className="w-full p-2 h-16 flex items-center justify-center text-gray-500 bg-gray-100 border-t border-b border-gray-300"
      >
        Select a cell to begin.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full p-1.5 sm:p-2 h-14 sm:h-16 flex items-center justify-between text-sm bg-blue-600 text-white rounded-lg shadow-md"
    >
      <button
        onClick={onPrevClue}
        className="p-1 sm:p-1.5 rounded-full hover:bg-blue-700"
        aria-label="Previous clue"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <div className="text-center">
        <span className="font-bold">
          {activeWord.id} {activeDirection}:{" "}
        </span>
        <span>{activeWord.clue}</span>
      </div>
      <button
        onClick={onNextClue}
        className="p-1 sm:p-1.5 rounded-full hover:bg-blue-700"
        aria-label="Next clue"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
};

export default ClueBar;
