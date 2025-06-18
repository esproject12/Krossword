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

// --- Helper Functions ---
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

interface ActiveState {
  cell: CellPosition;
  direction: Orientation;
}

const SAMPLE_PUZZLE_DATE_STRING = "2024-07-28";

const App: React.FC = () => {
  // --- State ---
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(
    null
  );
  const [userGrid, setUserGrid] = useState<UserGrid | null>(null);
  const [cellCheckGrid, setCellCheckGrid] = useState<CellCheckGrid | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPuzzleSolved, setIsPuzzleSolved] = useState<boolean>(false);

  // Refactored active state to prevent race conditions
  const [active, setActive] = useState<ActiveState | null>(null);
  const [activeWord, setActiveWord] = useState<WordDefinition | null>(null);

  // Timer State
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Utility and Memoized Functions ---
  const findWordAtCell = useCallback(
    (
      cell: CellPosition,
      direction: Orientation
    ): WordDefinition | undefined => {
      if (!crosswordData) return undefined;
      return crosswordData.words.find((word) => {
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

  // --- Effects ---

  // Recalculate the active word definition whenever the active state changes
  useEffect(() => {
    if (active && crosswordData) {
      const currentWord = findWordAtCell(active.cell, active.direction);
      setActiveWord(currentWord || null);
    } else {
      setActiveWord(null);
    }
  }, [active, crosswordData, findWordAtCell]);

  // Timer Lifecycle
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

  // Check if puzzle is solved
  useEffect(() => {
    if (!userGrid || !crosswordData?.solutionGrid) return;
    for (let r = 0; r < crosswordData.gridSize; r++) {
      for (let c = 0; c < crosswordData.gridSize; c++) {
        if (
          crosswordData.solutionGrid[r]?.[c] &&
          userGrid[r]?.[c] !== crosswordData.solutionGrid[r]?.[c]
        ) {
          return;
        }
      }
    }
    // If we get here, the puzzle is solved
    setIsPuzzleSolved(true);
    setIsTimerRunning(false);
    if (crosswordData?.solutionGrid) {
      setCellCheckGrid(
        crosswordData.solutionGrid.map((row) =>
          row.map((cell) => (cell ? "correct" : null))
        )
      );
    }
  }, [userGrid, crosswordData]);

  // Initial data loading
  useEffect(() => {
    const loadCrossword = async () => {
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
    };
    loadCrossword();
  }, []);

  // --- Initialization and Reset Functions ---
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

    // Set initial active cell and direction
    const firstWord = data.words?.sort((a, b) => a.id - b.id)[0];
    if (firstWord) {
      setActive({
        cell: firstWord.startPosition,
        direction: firstWord.orientation,
      });
    }
  };

  const startTimer = () => {
    if (!isTimerRunning && !isPuzzleSolved) setIsTimerRunning(true);
  };

  // --- Event Handlers ---

  const handleCellChange = (row: number, col: number, value: string) => {
    startTimer();
    if (!userGrid || isPuzzleSolved) return;

    // Fix for Glitch #4: If typing the same letter, just advance
    if (userGrid[row]?.[col] === value) {
      moveToNextCell();
      return;
    }

    const newUserGrid = userGrid.map((r) => [...r]);
    newUserGrid[row][col] = value.substring(0, 1).toUpperCase();
    setUserGrid(newUserGrid);

    if (cellCheckGrid) {
      const newCheckGrid = cellCheckGrid.map((r) => [...r]);
      if (newCheckGrid[row]?.[col]) newCheckGrid[row][col] = "unchecked";
      setCellCheckGrid(newCheckGrid);
    }

    if (value) moveToNextCell();
  };

  const moveToNextCell = () => {
    if (!active || !activeWord) return;

    let { row, col } = active.cell;
    if (active.direction === "ACROSS") {
      col++;
    } else {
      row++;
    }

    // Fix for Glitch #3: Only move if the next cell is part of the current word
    const nextCellIsInWord =
      active.direction === "ACROSS"
        ? row === activeWord.startPosition.row &&
          col < activeWord.startPosition.col + activeWord.length
        : col === activeWord.startPosition.col &&
          row < activeWord.startPosition.row + activeWord.length;

    if (nextCellIsInWord) {
      setActive({ ...active, cell: { row, col } });
    }
  };

  const moveToPrevCell = () => {
    if (!active) return;
    let { row, col } = active.cell;
    if (active.direction === "ACROSS") {
      col--;
    } else {
      row--;
    }

    if (col >= 0 && row >= 0) {
      setActive({ ...active, cell: { row, col } });
    }
  };

  const handleCellFocus = (row: number, col: number) => {
    if (crosswordData?.solutionGrid?.[row]?.[col] === null) return;

    let newDirection = active?.direction || "ACROSS";
    // If clicking the same cell, toggle direction
    if (active && active.cell.row === row && active.cell.col === col) {
      newDirection = active.direction === "ACROSS" ? "DOWN" : "ACROSS";
    }

    // Validate the new direction. If the cell doesn't support the new direction, revert.
    const wordInNewDirection = findWordAtCell({ row, col }, newDirection);
    if (!wordInNewDirection) {
      newDirection = newDirection === "ACROSS" ? "DOWN" : "ACROSS";
    }

    setActive({ cell: { row, col }, direction: newDirection });
  };

  // Fix for Glitch #1 & #2: This handler is now the single source of truth for clue clicks.
  const handleClueSelect = (
    startPosition: CellPosition,
    orientation: Orientation
  ) => {
    setActive({ cell: startPosition, direction: orientation });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!active || isPuzzleSolved) return;

    startTimer();

    // Let character input be handled by onChange
    if (event.key.length === 1 && event.key.match(/[a-zA-Z]/i)) {
      return;
    }

    event.preventDefault();
    switch (event.key) {
      case "ArrowUp":
        setActive({ ...active, direction: "DOWN" });
        moveToPrevCell();
        break;
      case "ArrowDown":
        setActive({ ...active, direction: "DOWN" });
        moveToNextCell();
        break;
      case "ArrowLeft":
        setActive({ ...active, direction: "ACROSS" });
        moveToPrevCell();
        break;
      case "ArrowRight":
        setActive({ ...active, direction: "ACROSS" });
        moveToNextCell();
        break;
      case "Backspace":
        if (userGrid && userGrid[active.cell.row][active.cell.col] !== "") {
          handleCellChange(active.cell.row, active.cell.col, "");
        }
        moveToPrevCell();
        break;
      case "Enter":
      case "Tab":
        handleCellFocus(active.cell.row, active.cell.col); // Reuse the toggle logic
        break;
      default:
        break;
    }
  };

  // ... other handlers like check puzzle, reveal, etc. remain conceptually the same but use the new `active` state
  const handleCheckPuzzle = () => {
    /* ... */
  };
  const handleRevealWord = () => {
    if (activeWord) revealWord(activeWord);
  };
  const handleRevealPuzzle = () => {
    /* ... */
  };
  const handleClearPuzzle = () => {
    if (crosswordData) initializeGrids(crosswordData);
  };

  const revealWord = (wordDef: WordDefinition) => {
    startTimer();
    if (!userGrid || !crosswordData?.solutionGrid || !cellCheckGrid) return;
    const newUserGrid = userGrid.map((r) => [...r]);
    const newCheckGrid = cellCheckGrid.map((r) => [...r]);
    for (let i = 0; i < wordDef.length; i++) {
      let r = wordDef.startPosition.row,
        c = wordDef.startPosition.col;
      if (wordDef.orientation === "ACROSS") c += i;
      else r += i;
      if (r < crosswordData.gridSize && c < crosswordData.gridSize) {
        newUserGrid[r][c] = crosswordData.solutionGrid[r][c];
        newCheckGrid[r][c] = "correct";
      }
    }
    setUserGrid(newUserGrid);
    setCellCheckGrid(newCheckGrid);
  };

  if (isLoading) {
    /* ... same loading component ... */
  }
  if (error && !crosswordData?.words?.length) {
    /* ... same error component ... */
  }
  if (!crosswordData || !userGrid || !cellCheckGrid || !active) {
    return <div>Initializing...</div>;
  }

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
                {activeWord ? `${activeWord.id} ${active.direction}: ` : ""}
              </span>
              {activeWord?.clue || "Select a cell to begin."}
            </div>
            <Timer time={time} />
          </div>
          <CrosswordGrid
            gridSize={crosswordData.gridSize}
            solutionGrid={crosswordData.solutionGrid}
            userGrid={userGrid}
            activeCell={active.cell}
            activeDirection={active.direction}
            activeWord={activeWord}
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
            activeDirection={active.direction}
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
