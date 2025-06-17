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
  crosswordData: CrosswordData;
  userGrid: UserGrid;
  activeCell: CellPosition | null;
  activeDirection: Orientation;
  cellCheckGrid: CellCheckGrid;
  onCellChange: (row: number, col: number, value: string) => void;
  onCellFocus: (row: number, col: number) => void;
  onCellKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => void;
  onCellClick: (row: number, col: number) => void;
}

const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  crosswordData,
  userGrid,
  activeCell,
  activeDirection,
  cellCheckGrid,
  onCellChange,
  onCellFocus,
  onCellKeyDown,
  onCellClick,
}) => {
  const { gridSize, solutionGrid, words } = crosswordData;
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(null))
  );

  useEffect(() => {
    if (activeCell) {
      inputRefs.current[activeCell.row]?.[activeCell.col]?.focus();
    }
  }, [activeCell]);

  const getClueNumber = (row: number, col: number): number | undefined => {
    // A cell gets a number if a word starts there (either across or down)
    const word = words.find(
      (w) => w.startPosition.row === row && w.startPosition.col === col
    );
    return word?.id;
  };

  // Find the word definition that the currently active cell is part of
  const activeWordDef = React.useMemo(() => {
    if (!activeCell || !words) return null;
    return words.find((word) => {
      if (word.orientation !== activeDirection) return false;
      if (activeDirection === "ACROSS") {
        return (
          word.startPosition.row === activeCell.row &&
          activeCell.col >= word.startPosition.col &&
          activeCell.col < word.startPosition.col + word.length
        );
      } else {
        // DOWN
        return (
          word.startPosition.col === activeCell.col &&
          activeCell.row >= word.startPosition.row &&
          activeCell.row < word.startPosition.row + word.length
        );
      }
    });
  }, [activeCell, activeDirection, words]);

  const isCellInActiveWord = (row: number, col: number): boolean => {
    if (!activeWordDef) return false;
    // Check if the cell (row, col) is part of the found active word definition
    if (activeDirection === "ACROSS") {
      return (
        row === activeWordDef.startPosition.row &&
        col >= activeWordDef.startPosition.col &&
        col < activeWordDef.startPosition.col + activeWordDef.length
      );
    } else {
      // DOWN
      return (
        col === activeWordDef.startPosition.col &&
        row >= activeWordDef.startPosition.row &&
        row < activeWordDef.startPosition.row + activeWordDef.length
      );
    }
  };

  return (
    <div
      className="grid gap-0.5 bg-gray-500 p-0.5 shadow-lg rounded"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
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
              clueNumber={getClueNumber(rowIndex, colIndex)}
              isBlackSquare={isBlack}
              isActive={isActive}
              isWordActive={isWordActive}
              checkState={checkState}
              onChange={(value) => onCellChange(rowIndex, colIndex, value)}
              onFocus={() => onCellFocus(rowIndex, colIndex)}
              onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
              onClick={() => onCellClick(rowIndex, colIndex)}
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
