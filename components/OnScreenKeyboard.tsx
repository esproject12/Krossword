// src/components/OnScreenKeyboard.tsx

import React, { useRef, useEffect } from "react";

interface ToolbarProps {
  onCheckPuzzle: () => void;
  onRevealWord: () => void;
  onRevealPuzzle: () => void;
  onClearPuzzle: () => void;
  isPuzzleSolved: boolean;
}

interface OnScreenKeyboardProps extends ToolbarProps {
  onKeyPress: (key: string) => void;
}

const KeyboardButton: React.FC<
  React.PropsWithChildren<{
   onClick: () => void;
    className?: string;
    flex?: number | string;
  }>
> = ({ children, onClick, className = "", flex = 1 }) => (
  <button
    onClick={onClick}
    // Default height is h-10. 'tall:' prefix makes it h-12 on tall screens.
    className={`h-12 tall:h-14 rounded-md font-semibold text-gray-800 flex items-center justify-center bg-white shadow-sm ${className}`}
    style={{ flex: `${flex}` }}
  >
    {children}
  </button>
);

const HintButton: React.FC<
  React.PropsWithChildren<{ onClick: () => void; disabled?: boolean }>
> = ({ children, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="h-12 w-full rounded-md font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
  >
    {children}
  </button>
);

const OnScreenKeyboard: React.FC<OnScreenKeyboardProps> = ({
  onKeyPress,
  onCheckPuzzle,
  onRevealWord,
  onRevealPuzzle,
  onClearPuzzle,
  isPuzzleSolved,
}) => {
  const [isHintView, setIsHintView] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      console.log(
        `%c[OnScreenKeyboard] Rendered size: ${ref.current.offsetHeight}px`,
        "color: #e67e22"
      );
    }
  });

  const keys = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["HINTS", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  const handleHintAction = (action: () => void) => {
    action();
    setIsHintView(false);
  };

  return (
    <div
      ref={ref}
      className="w-full max-w-lg mx-auto p-1 bg-gray-200/90 rounded-lg select-none"
    >
      {isHintView ? (
        <div className="flex flex-col gap-1.5 p-1">
          <div className="grid grid-cols-2 gap-1.5">
            <HintButton
              onClick={() => handleHintAction(onCheckPuzzle)}
              disabled={isPuzzleSolved}
            >
              Check Puzzle
            </HintButton>
            <HintButton
              onClick={() => handleHintAction(onRevealWord)}
              disabled={isPuzzleSolved}
            >
              Reveal Word
            </HintButton>
            <HintButton
              onClick={() => handleHintAction(onRevealPuzzle)}
              disabled={isPuzzleSolved}
            >
              Reveal Puzzle
            </HintButton>
            <HintButton onClick={() => handleHintAction(onClearPuzzle)}>
              Clear Puzzle
            </HintButton>
          </div>
          <button
            onClick={() => setIsHintView(false)}
            className="h-10 w-full rounded-md font-semibold text-gray-700 bg-gray-300 hover:bg-gray-400 mt-1"
          >
            Back to Keyboard
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 tall:gap-1.5">
          {keys.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1 w-full">
              {rowIndex === 1 && <div style={{ flex: 0.5 }} />}
              {row.map((key) => {
                const isHintKey = key === "HINTS";
                const isBackspaceKey = key === "BACKSPACE";
                const isSpecialKey = isHintKey || isBackspaceKey;

                return (
                  <KeyboardButton
                    key={key}
                    onClick={() =>
                      isHintKey ? setIsHintView(true) : onKeyPress(key)
                    }
                    className={isSpecialKey ? "bg-gray-400" : "bg-gray-50"}
                    flex={isSpecialKey ? 1.5 : 1}
                  >
                    {isBackspaceKey ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                    ) : isHintKey ? (
                      "💡"
                    ) : (
                      key
                    )}
                  </KeyboardButton>
                );
              })}
              {rowIndex === 1 && <div style={{ flex: 0.5 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OnScreenKeyboard;
