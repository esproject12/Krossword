
import React from 'react';

interface ToolbarProps {
  onCheckPuzzle: () => void;
  onRevealWord: () => void;
  onRevealPuzzle: () => void;
  onClearPuzzle: () => void;
  isPuzzleSolved: boolean;
}

const ToolbarButton: React.FC<React.PropsWithChildren<{ onClick: () => void; disabled?: boolean }>> = ({ children, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
  >
    {children}
  </button>
);


const Toolbar: React.FC<ToolbarProps> = ({ 
    onCheckPuzzle, 
    onRevealWord, 
    onRevealPuzzle, 
    onClearPuzzle,
    isPuzzleSolved
}) => {
  return (
    <div className="my-4 p-2 bg-gray-100 rounded-md shadow flex flex-wrap gap-2 justify-center items-center">
      <ToolbarButton onClick={onCheckPuzzle} disabled={isPuzzleSolved}>Check Puzzle</ToolbarButton>
      <ToolbarButton onClick={onRevealWord} disabled={isPuzzleSolved}>Reveal Word</ToolbarButton>
      <ToolbarButton onClick={onRevealPuzzle} disabled={isPuzzleSolved}>Reveal Puzzle</ToolbarButton>
      <ToolbarButton onClick={onClearPuzzle}>Clear Puzzle</ToolbarButton>
    </div>
  );
};

export default Toolbar;
