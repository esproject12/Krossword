// src/components/CrosswordGrid.tsx (with logging)
import React, { useRef, useEffect, useMemo } from "react";
import type {
  UserGrid,
  CellPosition,
  Orientation,
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
  onCellClick: (row: number, col: number) => void;
  onCellKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => void;
  isMobile?: boolean;
}

const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  crosswordData,
  userGrid,
  activeCell,
  activeDirection,
  cellCheckGrid,
  onCellChange,
  onCellClick,
  onCellKeyDown,
  isMobile = false,
}) => {
  console.log("%c[CrosswordGrid] Render Pass", "color: purple");

  const { gridSize, solutionGrid, words } = crosswordData;
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(null))
  );

  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      console.log(
        `%c[CrosswordGrid] DIAGNOSIS - Rendered size: Width=${rect.width.toFixed(
          2
        )}, Height=${rect.height.toFixed(2)}`,
        "color: purple; font-weight: bold"
      );
    }
  });

  useEffect(() => {
    if (activeCell) {
      console.log(
        `[CrosswordGrid] useEffect focusing cell: {row: ${activeCell.row}, col: ${activeCell.col}}`
      );
      inputRefs.current[activeCell.row]?.[activeCell.col]?.focus();
    }
  }, [activeCell]);

  const getClueNumberForCell = (
    row: number,
    col: number
  ): number | undefined => {
    return words.find(
      (w) => w.startPosition.row === row && w.startPosition.col === col
    )?.id;
  };

  const activeWord = useMemo(() => {
    if (!activeCell) return null;
    return words.find((word) => {
      if (word.orientation !== activeDirection) return false;
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
  }, [activeCell, activeDirection, words]);

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

  console.log("[CrosswordGrid] About to render grid cells.");
  return (
    <div
      ref={gridRef}
      // className="grid gap-px bg-gray-500 p-px shadow-lg rounded"
      className="grid w-full aspect-square gap-px bg-gray-500 p-px shadow-lg rounded"
  style={{
    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))` // <-- ADD THIS LINE 
    }}
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
              onCellClick={() => onCellClick(rowIndex, colIndex)}
              onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
              inputRef={(el) => {
                if (!inputRefs.current[rowIndex])
                  inputRefs.current[rowIndex] = [];
                inputRefs.current[rowIndex][colIndex] = el;
              }}
              isMobile={isMobile}
            />
          );
        })
      )}
    </div>
  );
};

export default React.memo(CrosswordGrid);
