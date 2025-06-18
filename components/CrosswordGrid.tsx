import React, { useRef, useEffect } from "react";
import type {
  UserGrid,
  CellPosition,
  Orientation,
  WordDefinition,
  CrosswordData,
  CellCheckGrid,
} from "../types";
import Cell from "./Cell";

interface CrosswordGridProps {
  gridSize: number;
  solutionGrid: (string | null)[][];
  userGrid: UserGrid;
  activeCell: CellPosition | null;
  activeDirection: Orientation;
  activeWord: WordDefinition | null;
  cellCheckGrid: CellCheckGrid;
  onCellChange: (row: number, col: number, value: string) => void;
  onCellFocus: (row: number, col: number) => void;
  onCellKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  gridSize,
  solutionGrid,
  userGrid,
  activeCell,
  activeDirection,
  activeWord,
  cellCheckGrid,
  onCellChange,
  onCellFocus,
  onCellKeyDown,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(null))
  );

  // Focus the input when the active cell changes
  useEffect(() => {
    if (activeCell) {
      inputRefs.current[activeCell.row]?.[activeCell.col]?.focus();
    }
  }, [activeCell]);

  const getClueNumber = (
    row: number,
    col: number,
    words: WordDefinition[]
  ): number | undefined => {
    const word = words.find(
      (w) => w.startPosition.row === row && w.startPosition.col === col
    );
    return word?.id;
  };

  const isCellInActiveWord = (row: number, col: number): boolean => {
    if (!activeWord) return false;
    if (activeWord.orientation === "ACROSS") {
      return (
        row === activeWord.startPosition.row &&
        col >= activeWord.startPosition.col &&
        col < activeWord.startPosition.col + activeWord.length
      );
    } else {
      // DOWN
      return (
        col === activeWord.startPosition.col &&
        row >= activeWord.startPosition.row &&
        row < activeWord.startPosition.row + activeWord.length
      );
    }
  };

  return (
    <div
      className="grid gap-0.5 bg-gray-500 p-0.5 shadow-lg rounded"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      onKeyDown={onCellKeyDown} // Move keydown listener to the container
    >
      {userGrid.map((rowArr, rowIndex) =>
        rowArr.map((cellValue, colIndex) => {
          const isBlack = solutionGrid[rowIndex][colIndex] === null;
          const isActive =
            activeCell?.row === rowIndex && activeCell?.col === colIndex;
          const isWordActive =
            !isBlack && !isActive && isCellInActiveWord(rowIndex, colIndex);
          const checkState = cellCheckGrid[rowIndex]?.[colIndex] || "unchecked";

          return (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              value={cellValue}
              clueNumber={getClueNumber(
                rowIndex,
                colIndex,
                activeWord ? [activeWord] : []
              )} // Simplified this
              isBlackSquare={isBlack}
              isActive={isActive}
              isWordActive={isWordActive}
              checkState={checkState}
              onChange={(value) => onCellChange(rowIndex, colIndex, value)}
              onFocus={() => onCellFocus(rowIndex, colIndex)}
              inputRef={(el) => {
                if (!inputRefs.current[rowIndex])
                  inputRefs.current[rowIndex] = [];
                inputRefs.current[rowIndex][colIndex] = el;
              }}
            />
          );
        })
      )}
    </div>
  );
};

export default CrosswordGrid;
