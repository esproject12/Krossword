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
import Timer from "./components/Timer"; // Import the new component
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPuzzleSolved, setIsPuzzleSolved] = useState<boolean>(false);
  const [activeWordId, setActiveWordId] = useState<number | undefined>(
    undefined
  );

  // Timer State
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer Lifecycle Logic
  useEffect(() => {
    if (isTimerRunning && !isPuzzleSolved) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, isPuzzleSolved]);

  const startTimer = () => {
    if (!isTimerRunning && !isPuzzleSolved) {
      setIsTimerRunning(true);
    }
  };

  const initializeGrids = (data: CrosswordData) => {
    const newUserGrid: UserGrid = data.solutionGrid.map((row) =>
      row.map((cell) => (cell === null ? null : ""))
    );
    setUserGrid(newUserGrid);

    const newCellCheckGrid: CellCheckGrid = data.solutionGrid.map((row) =>
      row.map((cell) =>
        cell === null ? null : ("unchecked" as CellCheckState)
      )
    );
    setCellCheckGrid(newCellCheckGrid);
    setIsPuzzleSolved(false);

    // Reset timer state for new puzzle
    setTime(0);
    setIsTimerRunning(false);
  };

  const setActiveWordAndCell = (data: CrosswordData) => {
    const firstWord = data.words?.sort((a, b) => a.id - b.id)[0];
    if (firstWord) {
      setActiveCell(firstWord.startPosition);
      setActiveDirection(firstWord.orientation);
      setActiveWordId(firstWord.id);
    } else if (data.gridSize > 0 && data.solutionGrid) {
      let firstAvailableCell: CellPosition | null = null;
      for (let r = 0; r < data.gridSize; r++) {
        for (let c = 0; c < data.gridSize; c++) {
          if (data.solutionGrid[r]?.[c] !== null) {
            firstAvailableCell = { row: r, col: c };
            break;
          }
        }
        if (firstAvailableCell) break;
      }
      if (firstAvailableCell) {
        setActiveCell(firstAvailableCell);
        setActiveDirection("ACROSS");
        setActiveWordId(undefined);
      }
    }
  };

  const loadCrossword = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const today = getTodayDateString();
    const cachedPuzzleKey = `crossword_${today}`;

    try {
      const cachedItem = localStorage.getItem(cachedPuzzleKey);
      if (cachedItem) {
        const parsedCache = JSON.parse(cachedItem) as CachedCrossword;
        if (parsedCache.date === today && parsedCache.data) {
          setCrosswordData(parsedCache.data);
          initializeGrids(parsedCache.data);
          setActiveWordAndCell(parsedCache.data);
          setIsLoading(false);
          return;
        } else {
          localStorage.removeItem(cachedPuzzleKey);
        }
      }
    } catch (e) {
      console.error("Failed to load or parse cached crossword:", e);
      localStorage.removeItem(cachedPuzzleKey);
    }

    try {
      const data = await fetchPreGeneratedCrossword(today);
      setCrosswordData(data);
      initializeGrids(data);
      setActiveWordAndCell(data);
      localStorage.setItem(
        cachedPuzzleKey,
        JSON.stringify({ date: today, data: data } as CachedCrossword)
      );
    } catch (err) {
      console.warn(
        `Failed to load today's puzzle (${today}). Trying sample puzzle.`
      );
      try {
        const sampleData = await fetchPreGeneratedCrossword(
          SAMPLE_PUZZLE_DATE_STRING
        );
        setCrosswordData(sampleData);
        initializeGrids(sampleData);
        setActiveWordAndCell(sampleData);
        setError(
          `Today's puzzle (${today}) was not found. Displaying a sample puzzle.`
        );
      } catch (sampleErr) {
        console.error("Failed to load sample puzzle:", sampleErr);
        setError(`Failed to load any puzzles. Please try again later.`);
        const fallbackGridSize = DEFAULT_GRID_SIZE;
        const fallbackData: CrosswordData = {
          gridSize: fallbackGridSize,
          title: "Error Loading Puzzle",
          words: [],
          solutionGrid: Array(fallbackGridSize)
            .fill(null)
            .map(() => Array(fallbackGridSize).fill(null)),
        };
        setCrosswordData(fallbackData);
        initializeGrids(fallbackData);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrossword();
  }, [loadCrossword]);

  const findWordAtCell = useCallback(
    (
      row: number,
      col: number,
      direction: Orientation
    ): WordDefinition | undefined => {
      if (!crosswordData) return undefined;
      return crosswordData.words.find((word) => {
        if (word.orientation !== direction) return false;
        if (direction === "ACROSS") {
          return (
            word.startPosition.row === row &&
            col >= word.startPosition.col &&
            col < word.startPosition.col + word.length
          );
        } else {
          return (
            word.startPosition.col === col &&
            row >= word.startPosition.row &&
            row < word.startPosition.row + word.length
          );
        }
      });
    },
    [crosswordData]
  );

  useEffect(() => {
    if (activeCell && crosswordData) {
      const currentWord = findWordAtCell(
        activeCell.row,
        activeCell.col,
        activeDirection
      );
      const activeWord = crosswordData.words.find(
        (w) => w.id === currentWord?.id && w.orientation === activeDirection
      );
      setActiveWordId(activeWord?.id);
    } else {
      setActiveWordId(undefined);
    }
  }, [activeCell, activeDirection, crosswordData, findWordAtCell]);

  const checkPuzzleSolved = useCallback(() => {
    if (!userGrid || !crosswordData?.solutionGrid) return false;
    for (let r = 0; r < crosswordData.gridSize; r++) {
      for (let c = 0; c < crosswordData.gridSize; c++) {
        const solutionCell = crosswordData.solutionGrid[r]?.[c];
        if (solutionCell !== null) {
          if (userGrid[r]?.[c]?.toUpperCase() !== solutionCell.toUpperCase()) {
            return false;
          }
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
        const newCheckGrid: CellCheckGrid = crosswordData.solutionGrid.map(
          (rowCells) =>
            rowCells.map((cell) => (cell === null ? null : "correct"))
        );
        setCellCheckGrid(newCheckGrid);
      }
    }
  }, [userGrid, crosswordData, checkPuzzleSolved]);

  const handleCellChange = (row: number, col: number, value: string) => {
    startTimer();
    if (!userGrid || !crosswordData?.solutionGrid || isPuzzleSolved) return;
    const newUserGrid = userGrid.map((r) => [...r]);
    newUserGrid[row][col] = value.substring(0, 1).toUpperCase();
    setUserGrid(newUserGrid);

    if (cellCheckGrid) {
      const newCheckGrid = cellCheckGrid.map((r) => [...r]);
      if (newCheckGrid[row]?.[col]) newCheckGrid[row][col] = "unchecked";
      setCellCheckGrid(newCheckGrid);
    }

    if (value) {
      let nextRow = row;
      let nextCol = col;
      if (activeDirection === "ACROSS") {
        nextCol++;
        while (
          nextCol < crosswordData.gridSize &&
          crosswordData.solutionGrid[nextRow]?.[nextCol] === null
        ) {
          nextCol++;
        }
      } else {
        nextRow++;
        while (
          nextRow < crosswordData.gridSize &&
          crosswordData.solutionGrid[nextRow]?.[nextCol] === null
        ) {
          nextRow++;
        }
      }
      if (
        nextRow < crosswordData.gridSize &&
        nextCol < crosswordData.gridSize &&
        crosswordData.solutionGrid[nextRow]?.[nextCol] !== null
      ) {
        setActiveCell({ row: nextRow, col: nextCol });
      }
    }
  };

  const handleCellFocus = (row: number, col: number) => {
    if (crosswordData?.solutionGrid?.[row]?.[col] === null) return;
    const oldActiveCell = activeCell;
    const newActiveCell = { row, col };
    if (oldActiveCell?.row === row && oldActiveCell?.col === col) {
      const wordAcross = findWordAtCell(row, col, "ACROSS");
      const wordDown = findWordAtCell(row, col, "DOWN");
      if (wordAcross && wordDown) {
        setActiveDirection((prev) => (prev === "ACROSS" ? "DOWN" : "ACROSS"));
      }
    } else {
      const supportsCurrentDirection = findWordAtCell(
        row,
        col,
        activeDirection
      );
      if (!supportsCurrentDirection) {
        const wordAcross = findWordAtCell(row, col, "ACROSS");
        if (wordAcross) {
          setActiveDirection("ACROSS");
        } else {
          setActiveDirection("DOWN");
        }
      }
    }
    setActiveCell(newActiveCell);
  };

  const handleCellClick = (row: number, col: number) => {
    handleCellFocus(row, col);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (!crosswordData?.solutionGrid || !activeCell || isPuzzleSolved) return;
    if (event.key.length === 1 && event.key.match(/[a-zA-Z]/i)) {
      startTimer(); // Also start timer on keyboard input
      return;
    }
    let newRow = row,
      newCol = col,
      moved = false;
    const moveAndSetDirection = (dr: number, dc: number, dir: Orientation) => {
      event.preventDefault();
      setActiveDirection(dir);
      let r = row + dr,
        c = col + dc;
      while (
        r >= 0 &&
        r < crosswordData.gridSize &&
        c >= 0 &&
        c < crosswordData.gridSize &&
        crosswordData.solutionGrid[r]?.[c] === null
      ) {
        r += dr;
        c += dc;
      }
      if (
        r >= 0 &&
        r < crosswordData.gridSize &&
        c >= 0 &&
        c < crosswordData.gridSize &&
        crosswordData.solutionGrid[r]?.[c] !== null
      ) {
        newRow = r;
        newCol = c;
        moved = true;
      }
    };
    switch (event.key) {
      case "ArrowUp":
        moveAndSetDirection(-1, 0, "DOWN");
        break;
      case "ArrowDown":
        moveAndSetDirection(1, 0, "DOWN");
        break;
      case "ArrowLeft":
        moveAndSetDirection(0, -1, "ACROSS");
        break;
      case "ArrowRight":
        moveAndSetDirection(0, 1, "ACROSS");
        break;
      case "Backspace":
        event.preventDefault();
        startTimer();
        if (userGrid?.[row]?.[col]) {
          handleCellChange(row, col, "");
        } else {
          const dr = activeDirection === "DOWN" ? -1 : 0;
          const dc = activeDirection === "ACROSS" ? -1 : 0;
          let prevR = row + dr,
            prevC = col + dc;
          while (
            prevR >= 0 &&
            prevR < crosswordData.gridSize &&
            prevC >= 0 &&
            prevC < crosswordData.gridSize &&
            crosswordData.solutionGrid[prevR]?.[prevC] === null
          ) {
            prevR += dr;
            prevC += dc;
          }
          if (
            prevR >= 0 &&
            prevR < crosswordData.gridSize &&
            prevC >= 0 &&
            prevC < crosswordData.gridSize &&
            crosswordData.solutionGrid[prevR]?.[prevC] !== null
          ) {
            setActiveCell({ row: prevR, col: prevC });
            handleCellChange(prevR, prevC, "");
          }
        }
        break;
      case "Enter":
      case "Tab":
        event.preventDefault();
        handleCellFocus(row, col);
        return;
      default:
        return;
    }
    if (moved) {
      setActiveCell({ row: newRow, col: newCol });
    }
  };

  const handleClueSelect = (
    startPosition: CellPosition,
    orientation: Orientation
  ) => {
    setActiveDirection(orientation);
    setActiveCell(startPosition);
  };

  const handleCheckPuzzle = () => {
    if (!userGrid || !crosswordData?.solutionGrid || !cellCheckGrid) return;
    const newCheckGrid = cellCheckGrid.map((r) => [...r]);
    for (let r = 0; r < crosswordData.gridSize; r++) {
      for (let c = 0; c < crosswordData.gridSize; c++) {
        if (crosswordData.solutionGrid[r]?.[c] !== null) {
          const userVal = userGrid[r]?.[c];
          if (userVal) {
            const isCorrect =
              userVal.toUpperCase() ===
              crosswordData.solutionGrid[r]?.[c]?.toUpperCase();
            newCheckGrid[r][c] = isCorrect ? "correct" : "incorrect";
          }
        }
      }
    }
    setCellCheckGrid(newCheckGrid);
    if (checkPuzzleSolved()) setIsPuzzleSolved(true);
  };

  const revealWord = (wordDef: WordDefinition) => {
    startTimer();
    if (!userGrid || !crosswordData?.solutionGrid || !cellCheckGrid) return;
    const newUserGrid = userGrid.map((r) => [...r]);
    const newCheckGrid = cellCheckGrid.map((r) => [...r]);
    for (let i = 0; i < wordDef.length; i++) {
      let r = wordDef.startPosition.row;
      let c = wordDef.startPosition.col;
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

  const handleRevealWord = () => {
    if (!activeCell || !crosswordData) return;
    const wordToReveal = findWordAtCell(
      activeCell.row,
      activeCell.col,
      activeDirection
    );
    if (wordToReveal) {
      revealWord(wordToReveal);
    }
  };

  const handleRevealPuzzle = () => {
    startTimer();
    if (!crosswordData?.solutionGrid) return;
    setUserGrid(crosswordData.solutionGrid.map((r) => [...r]));
    setCellCheckGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell === null ? null : "correct"))
      )
    );
    setIsPuzzleSolved(true);
  };

  const handleClearPuzzle = () => {
    if (crosswordData) {
      initializeGrids(crosswordData);
      setActiveWordAndCell(crosswordData);
    }
  };

  const currentClue =
    activeCell && crosswordData
      ? findWordAtCell(activeCell.row, activeCell.col, activeDirection)?.clue
      : "Select a cell or clue to begin.";

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-xl text-gray-700 bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mr-3"></div>
        Loading Daily Dodo Krossword...
      </div>
    );
  }

  if (error && (!crosswordData || crosswordData.words.length === 0)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-600 p-4 bg-red-50 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-red-400 mb-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-2xl font-bold mb-2">Error Loading Puzzle</h2>
        <p className="mb-4 px-4 text-sm text-gray-700 max-w-2xl">{error}</p>
        <button
          onClick={loadCrossword}
          className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!crosswordData || !userGrid || !cellCheckGrid) {
    return (
      <div className="flex justify-center items-center h-screen text-xl text-gray-600 p-4 text-center">
        Initializing puzzle... Please wait.
      </div>
    );
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
        {error && crosswordData.words.length > 0 && (
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
                {activeWordId
                  ? `${activeWordId} ${
                      activeDirection === "ACROSS" ? "Across" : "Down"
                    }: `
                  : ""}
              </span>
              {currentClue}
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
            onCellClick={handleCellClick}
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
            activeWordId={activeWordId}
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
