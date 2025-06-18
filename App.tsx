import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchPreGeneratedCrossword } from "./services/geminiService";
import type {
  CrosswordData,
  UserGrid,
  CellPosition,
  Orientation,
  WordDefinition,
  CellCheckGrid,
  CellCheckState,
} from "./types";
import CrosswordGrid from "./components/CrosswordGrid";
import ClueList from "./components/ClueList";
import Toolbar from "./components/Toolbar";
import Timer from "./components/Timer";
import { DEFAULT_GRID_SIZE } from "./constants";

const getTodayDateString = (): string => {
  const now = new Date();
  const istDateString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  const istDate = new Date(istDateString);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface CachedCrossword {
  date: string;
  data: CrosswordData;
}

const SAMPLE_PUZZLE_DATE_STRING = "2024-07-28";

const App: React.FC = () => {
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(
    null
  );
  const [userGrid, setUserGrid] = useState<UserGrid | null>(null);
  const [cellCheckGrid, setCellCheckGrid] = useState<CellCheckGrid | null>(
    null
  );
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [activeDirection, setActiveDirection] = useState<Orientation>("ACROSS");
  const [activeWord, setActiveWord] = useState<WordDefinition | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPuzzleSolved, setIsPuzzleSolved] = useState<boolean>(false);
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const findWordAtCell = useCallback(
    (
      cell: CellPosition,
      direction: Orientation,
      data: CrosswordData | null = crosswordData
    ): WordDefinition | undefined => {
      if (!data) return undefined;
      return data.words.find((word) => {
        if (word.orientation !== direction) return false;
        if (direction === "ACROSS") {
          return (
            word.startPosition.row === cell.row &&
            cell.col >= word.startPosition.col &&
            cell.col < word.startPosition.col + word.length
          );
        } else {
          return (
            word.startPosition.col === cell.col &&
            cell.row >= word.startPosition.row &&
            cell.row < word.startPosition.row + word.length
          );
        }
      });
    },
    [crosswordData]
  );

  useEffect(() => {
    if (activeCell) {
      const word = findWordAtCell(activeCell, activeDirection);
      setActiveWord(word || null);
    }
  }, [activeCell, activeDirection, findWordAtCell]);

  useEffect(() => {
    if (isTimerRunning && !isPuzzleSolved) {
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isPuzzleSolved]);

  const checkPuzzleSolved = useCallback(() => {
    if (!userGrid || !crosswordData?.solutionGrid) return false;
    for (let r = 0; r < crosswordData.gridSize; r++) {
      for (let c = 0; c < crosswordData.gridSize; c++) {
        if (
          crosswordData.solutionGrid[r]?.[c] &&
          userGrid[r]?.[c]?.toUpperCase() !==
            crosswordData.solutionGrid[r]?.[c]?.toUpperCase()
        ) {
          return false;
        }
      }
    }
    return true;
  }, [userGrid, crosswordData]);

  useEffect(() => {
    if (checkPuzzleSolved()) {
      setIsPuzzleSolved(true);
      setIsTimerRunning(false);
      if (crosswordData?.solutionGrid) {
        setCellCheckGrid(
          crosswordData.solutionGrid.map((row) =>
            row.map((cell) => (cell ? "correct" : null))
          )
        );
      }
    }
  }, [checkPuzzleSolved, crosswordData]);

  const initializeGrids = (data: CrosswordData) => {
    setUserGrid(
      data.solutionGrid.map((row) => row.map((cell) => (cell ? "" : null)))
    );
    setCellCheckGrid(
      data.solutionGrid.map((row) =>
        row.map((cell) => (cell ? "unchecked" : null))
      )
    );
    setIsPuzzleSolved(false);
    setTime(0);
    setIsTimerRunning(false);
    const firstWord = data.words?.sort((a, b) => a.id - b.id)[0];
    if (firstWord) {
      setActiveCell(firstWord.startPosition);
      setActiveDirection(firstWord.orientation);
    }
  };

  const loadCrossword = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const today = getTodayDateString();
    try {
      const data = await fetchPreGeneratedCrossword(today);
      setCrosswordData(data);
      initializeGrids(data);
    } catch (err) {
      console.warn(`Failed to load puzzle for ${today}. Trying sample.`);
      try {
        const sampleData = await fetchPreGeneratedCrossword(
          SAMPLE_PUZZLE_DATE_STRING
        );
        setCrosswordData(sampleData);
        initializeGrids(sampleData);
        setError(
          `Today's puzzle (${today}) was not found. Displaying a sample puzzle.`
        );
      } catch (sampleErr) {
        console.error("Failed to load sample puzzle:", sampleErr);
        setError(`Failed to load any puzzles. Please try again later.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrossword();
  }, [loadCrossword]);

  const startTimer = () => {
    if (!isTimerRunning && !isPuzzleSolved) setIsTimerRunning(true);
  };

  const moveToNextCell = () => {
    if (!activeCell || !activeWord) return;
    let { row, col } = activeCell;
    const { length, startPosition } = activeWord;

    if (activeDirection === "ACROSS") {
      if (col < startPosition.col + length - 1) {
        setActiveCell({ row, col: col + 1 });
      }
    } else {
      if (row < startPosition.row + length - 1) {
        setActiveCell({ row: row + 1, col });
      }
    }
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    startTimer();
    if (!userGrid || isPuzzleSolved) return;

    if (value && userGrid[row]?.[col]?.toUpperCase() === value.toUpperCase()) {
      moveToNextCell();
      return;
    }

    const newUserGrid = [...userGrid];
    newUserGrid[row] = [...newUserGrid[row]];
    newUserGrid[row][col] = value.substring(0, 1).toUpperCase();
    setUserGrid(newUserGrid);

    if (cellCheckGrid) {
      const newCheckGrid = [...cellCheckGrid];
      newCheckGrid[row] = [...newCheckGrid[row]];
      newCheckGrid[row][col] = "unchecked";
      setCellCheckGrid(newCheckGrid);
    }

    if (value) {
      moveToNextCell();
    }
  };

  const handleCellFocus = (row: number, col: number) => {
    if (crosswordData?.solutionGrid?.[row]?.[col] === null) return;

    const isSameCell = activeCell?.row === row && activeCell?.col === col;
    let newDirection = activeDirection;

    if (isSameCell) {
      newDirection = activeDirection === "ACROSS" ? "DOWN" : "ACROSS";
      if (!findWordAtCell({ row, col }, newDirection)) {
        newDirection = activeDirection; // Revert if no word in new direction
      }
    } else {
      if (!findWordAtCell({ row, col }, newDirection)) {
        newDirection = activeDirection === "ACROSS" ? "DOWN" : "ACROSS";
      }
    }
    setActiveCell({ row, col });
    setActiveDirection(newDirection);
  };

  const handleClueSelect = (
    startPosition: CellPosition,
    orientation: Orientation
  ) => {
    setActiveCell(startPosition);
    setActiveDirection(orientation);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (isPuzzleSolved) return;

    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
      startTimer();
      return; // Let onChange handle it
    }
    event.preventDefault();

    const move = (dr: number, dc: number) => {
      const newRow = row + dr;
      const newCol = col + dc;
      if (
        newRow >= 0 &&
        newRow < (crosswordData?.gridSize || 0) &&
        newCol >= 0 &&
        newCol < (crosswordData?.gridSize || 0) &&
        crosswordData?.solutionGrid[newRow][newCol] !== null
      ) {
        handleCellFocus(newRow, newCol);
      }
    };

    switch (event.key) {
      case "ArrowUp":
        setActiveDirection("DOWN");
        move(-1, 0);
        break;
      case "ArrowDown":
        setActiveDirection("DOWN");
        move(1, 0);
        break;
      case "ArrowLeft":
        setActiveDirection("ACROSS");
        move(0, -1);
        break;
      case "ArrowRight":
        setActiveDirection("ACROSS");
        move(0, 1);
        break;
      case "Backspace":
        startTimer();
        if (userGrid?.[row]?.[col]) {
          handleCellChange(row, col, "");
        } else {
          const prevRow = activeDirection === "DOWN" ? row - 1 : row;
          const prevCol = activeDirection === "ACROSS" ? col - 1 : col;
          if (
            prevRow >= 0 &&
            prevCol >= 0 &&
            crosswordData?.solutionGrid[prevRow][prevCol] !== null
          ) {
            setActiveCell({ row: prevRow, col: prevCol });
          }
        }
        break;
      case "Enter":
      case " ":
        handleCellFocus(row, col);
        break;
      default:
        break;
    }
  };

  const handleCheckPuzzle = () => {
    /* Unchanged */
  };
  const handleRevealWord = () => {
    /* Unchanged */
  };
  const handleRevealPuzzle = () => {
    /* Unchanged */
  };
  const handleClearPuzzle = () => {
    if (crosswordData) initializeGrids(crosswordData);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!crosswordData || !userGrid || !cellCheckGrid || !activeCell)
    return <div>Initializing...</div>;

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-5xl bg-gray-50 min-h-screen flex flex-col">
      <header className="text-center my-4 sm:my-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700 tracking-tight">
          Dodo Krossword
        </h1>
        <p className="text-lg text-gray-600 mt-1">
          {crosswordData.title || "Daily Indian Mini"}
        </p>
        {error && (
          <p className="text-sm text-red-500 mt-2 bg-red-100 p-2 rounded-md shadow">
            Note: {error}
          </p>
        )}
      </header>
      <main className="flex flex-col lg:flex-row gap-4 md:gap-6 items-start justify-center flex-grow">
        <div className="w-full lg:w-auto flex flex-col items-center">
          <div className="w-full max-w-md flex justify-between items-center mb-3 gap-2">
            <div
              className="p-2 border border-gray-300 rounded-md bg-white shadow-sm text-sm text-gray-700 min-h-[4em] flex items-center justify-center text-center flex-grow"
              role="status"
              aria-live="polite"
            >
              <span className="font-semibold mr-2">
                {activeWord ? `${activeWord.id} ${activeDirection}: ` : ""}
              </span>
              {activeWord?.clue || "Select a cell to begin."}
            </div>
            <Timer time={time} />
          </div>
          <CrosswordGrid
            crosswordData={crosswordData}
            userGrid={userGrid}
            activeCell={activeCell}
            activeDirection={activeDirection}
            cellCheckGrid={cellCheckGrid}
            onCellChange={handleCellChange}
            onCellFocus={handleCellFocus}
            onCellKeyDown={handleKeyDown}
          />
          <Toolbar
            onCheckPuzzle={handleCheckPuzzle}
            onRevealWord={handleRevealWord}
            onRevealPuzzle={handleRevealPuzzle}
            onClearPuzzle={handleClearPuzzle}
            isPuzzleSolved={isPuzzleSolved}
          />
        </div>
        <div className="w-full lg:flex-1 bg-white p-3 rounded-lg shadow-md overflow-hidden">
          {isPuzzleSolved && (
            <div
              className="p-3 mb-3 bg-green-100 text-green-700 rounded-md text-center font-semibold text-lg flex items-center justify-center"
              role="alert"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Congratulations! You solved the puzzle in {Math.floor(time / 60)}m{" "}
              {time % 60}s!
            </div>
          )}
          <ClueList
            words={crosswordData.words}
            onClueSelect={handleClueSelect}
            activeWordId={activeWord?.id}
            activeDirection={activeDirection}
          />
        </div>
      </main>
      <footer className="text-center text-xs text-gray-500 mt-auto py-4 border-t border-gray-200">
        Dodo Krossword – daily puzzles inspired by India!
      </footer>
    </div>
  );
};

export default App;
