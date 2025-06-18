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

  const getClueNumberForCell = (
    row: number,
    col: number
  ): number | undefined => {
    const word = words.find(
      (w) => w.startPosition.row === row && w.startPosition.col === col
    );
    return word?.id;
  };

  const activeWord = words.find((word) => {
    if (!activeCell || word.orientation !== activeDirection) return false;
    if (activeDirection === "ACROSS") {
      return (
        word.startPosition.row === activeCell.row &&
        activeCell.col >= word.startPosition.col &&
        activeCell.col < word.startPosition.col + word.length
      );
    } else {
      return (
        word.startPosition.col === activeCell.col &&
        activeCell.row >= word.startPosition.row &&
        activeCell.row < word.startPosition.row + word.length
      );
    }
  });

  const isCellInActiveWord = (row: number, col: number): boolean => {
    if (!activeWord) return false;
    if (activeWord.orientation === "ACROSS") {
      return (
        row === activeWord.startPosition.row &&
        col >= activeWord.startPosition.col &&
        col < activeWord.startPosition.col + activeWord.length
      );
    } else {
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
              clueNumber={getClueNumberForCell(rowIndex, colIndex)}
              isBlackSquare={isBlack}
              isActive={isActive}
              isWordActive={isWordActive}
              checkState={checkState}
              onChange={(value) => onCellChange(rowIndex, colIndex, value)}
              onFocus={() => onCellFocus(rowIndex, colIndex)}
              onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
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
