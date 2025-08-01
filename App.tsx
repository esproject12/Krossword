// Krossword-main/App.tsx (Final Diagnostic Version with CSS Grid)

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
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
import { useMediaQuery } from "./hooks/useMediaQuery";
import ClueBar from "./components/ClueBar";
import OnScreenKeyboard from "./components/OnScreenKeyboard";

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

// PASTE THIS ENTIRE CODE BLOCK TO REPLACE THE EXISTING CrosswordGame COMPONENT

const CrosswordGame: React.FC<{
  initialData: CrosswordData;
  error?: string | null;
}> = ({ initialData, error }) => {
  console.log("%c[CrosswordGame] Render Pass", "color: orange;");

  const isMobile = useMediaQuery("(max-width: 768px)");

  const headerRef = useRef<HTMLElement>(null);
  const mobileMainRef = useRef<HTMLElement>(null);
  const mobileGridContainerRef = useRef<HTMLDivElement>(null);
  const mobileFooterRef = useRef<HTMLElement>(null);

  // --- DIAGNOSTIC HOOK (STAYS IN PLACE) ---
  // DELETE your current useLayoutEffect and REPLACE it with this entire block.

  useLayoutEffect(() => {
    const calculateAndFixLayout = () => {
      if (isMobile && headerRef.current && mobileMainRef.current && mobileGridContainerRef.current && mobileFooterRef.current) {
        
        const viewportHeight = window.innerHeight;
        const headerHeight = headerRef.current.offsetHeight;

        const mainContainer = mobileMainRef.current;
        const timerContainer = mainContainer.children[0] as HTMLElement;
        const gridContainer = mobileGridContainerRef.current;
        const footerContainer = mobileFooterRef.current;

        const timerHeight = timerContainer.offsetHeight;
        const footerHeight = footerContainer.offsetHeight;
        
        // --- THE CALCULATION ---
        // We find the total height of all non-flexible elements.
        // We also account for the padding/margins inside <main> (pb-2 is 8px)
        const totalNonFlexibleHeight = headerHeight + timerHeight + footerHeight + 8; // 8px for pb-2
        
        // The correct height for the grid is whatever is left over.
        const correctGridHeight = viewportHeight - totalNonFlexibleHeight;

        // --- THE FIX ---
        // We apply this calculated height directly to the grid container.
        gridContainer.style.height = `${correctGridHeight}px`;

        // --- THE VERIFICATION (Logging) ---
        console.clear();
        console.log(`%c--- ACTIVE LAYOUT FIX REPORT ---`, "color: #4CAF50; font-weight: bold; font-size: 16px;");
        console.log(`[Screen] Viewport Height:            ${viewportHeight}px`);
        console.log(`[Header] Header Height:             -${headerHeight}px`);
        console.log(`[Timer] Timer Height:                -${timerHeight}px`);
        console.log(`[Footer] Footer Height:              -${footerHeight}px`);
        console.log(`[Spacing] Bottom Padding:            -8px`);
        console.log('--------------------------------------------------');
        console.log(`[Grid] CALCULATED CORRECT HEIGHT:   = ${correctGridHeight}px`);

        if (correctGridHeight < 100) {
          console.error("Layout Fix Error: Calculated grid height is too small. Check measurements.");
        } else {
          console.log("Layout fix applied successfully.");
        }
      }
    };

    // Run the fix after a short delay to ensure all elements have rendered
    const timerId = setTimeout(calculateAndFixLayout, 500);

    // Also run it on resize for robustness
    window.addEventListener('resize', calculateAndFixLayout);

    return () => {
      clearTimeout(timerId);
      window.removeEventListener('resize', calculateAndFixLayout);
    };
  }, [isMobile]);
  
  const [crosswordData] = useState<CrosswordData>(initialData);
  const [userGrid, setUserGrid] = useState<UserGrid>(() =>
    initialData.solutionGrid.map((row) => row.map((cell) => (cell ? "" : null)))
  );
  const [cellCheckGrid, setCellCheckGrid] = useState<CellCheckGrid>(() =>
    initialData.solutionGrid.map((row) =>
      row.map((cell) => (cell ? ("unchecked" as CellCheckState) : null))
    )
  );
  const [activeCell, setActiveCell] = useState<CellPosition | null>(() => {
    const firstWord = initialData.words?.sort((a, b) => a.id - b.id)[0];
    if (firstWord) return firstWord.startPosition;
    for (let r = 0; r < initialData.gridSize; r++) {
      for (let c = 0; c < initialData.gridSize; c++) {
        if (initialData.solutionGrid[r][c]) return { row: r, col: c };
      }
    }
    return null;
  });
  const [activeDirection, setActiveDirection] = useState<Orientation>(() => {
    const firstWord = initialData.words?.sort((a, b) => a.id - b.id)[0];
    return firstWord?.orientation || "ACROSS";
  });
  const [isPuzzleSolved, setIsPuzzleSolved] = useState<boolean>(false);
  const [time, setTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const findWordAtCell = useCallback(
    (
      cell: CellPosition,
      direction: Orientation
    ): WordDefinition | undefined => {
      if (!crosswordData || !cell) return undefined;
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

  const activeWord = useMemo(() => {
    if (!activeCell) return null;
    return findWordAtCell(activeCell, activeDirection);
  }, [activeCell, activeDirection, findWordAtCell]);

  const startTimer = () => {
    if (!isTimerRunning && !isPuzzleSolved) setIsTimerRunning(true);
  };

  const checkPuzzleSolved = useCallback(() => {
    if (!userGrid) return false;
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
    }
  }, [userGrid, checkPuzzleSolved]);

  useEffect(() => {
    if (isTimerRunning && !isPuzzleSolved) {
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isPuzzleSolved]);

  const getWordPath = useCallback((word: WordDefinition): CellPosition[] => {
    const path: CellPosition[] = [];
    for (let i = 0; i < word.length; i++) {
      if (word.orientation === "ACROSS") {
        path.push({
          row: word.startPosition.row,
          col: word.startPosition.col + i,
        });
      } else {
        path.push({
          row: word.startPosition.row + i,
          col: word.startPosition.col,
        });
      }
    }
    return path;
  }, []);

  const findNextEditableCell = useCallback(
    (
      word: WordDefinition,
      fromCell: CellPosition | null,
      searchForward: boolean = true
    ): CellPosition | null => {
      if (!userGrid) return null;
      const wordPath = getWordPath(word);
      let startIndex = fromCell
        ? wordPath.findIndex(
            (p) => p.row === fromCell.row && p.col === fromCell.col
          )
        : -1;
      if (searchForward) {
        for (let i = startIndex + 1; i < wordPath.length; i++) {
          const pos = wordPath[i];
          if (userGrid[pos.row][pos.col] === "") return pos;
        }
      } else {
        for (let i = startIndex - 1; i >= 0; i--) {
          const pos = wordPath[i];
          if (userGrid[pos.row][pos.col] === "") return pos;
        }
      }
      return null;
    },
    [userGrid, getWordPath]
  );

  const moveToNextCell = () => {
    if (!activeCell || !activeWord) return;
    const wordPath = getWordPath(activeWord);
    const currentIndex = wordPath.findIndex(
      (p) => p.row === activeCell.row && p.col === activeCell.col
    );
    if (currentIndex !== -1 && currentIndex < wordPath.length - 1) {
      setActiveCell(wordPath[currentIndex + 1]);
    }
  };

  const moveToPrevCell = () => {
    if (!activeCell || !activeWord) return;
    const wordPath = getWordPath(activeWord);
    const currentIndex = wordPath.findIndex(
      (p) => p.row === activeCell.row && p.col === activeCell.col
    );
    if (currentIndex > 0) {
      setActiveCell(wordPath[currentIndex - 1]);
    }
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    if (!userGrid || isPuzzleSolved) return;
    startTimer();
    const upperValue = value.substring(0, 1).toUpperCase();
    if (userGrid[row][col] === upperValue && upperValue !== "") {
      moveToNextCell();
      return;
    }
    const newUserGrid = userGrid.map((r, rIdx) =>
      rIdx === row ? r.map((c, cIdx) => (cIdx === col ? upperValue : c)) : r
    );
    setUserGrid(newUserGrid);
    if (cellCheckGrid) {
      const newCheckGrid = cellCheckGrid.map((r, rIdx) =>
        rIdx === row
          ? r.map((c, cIdx) =>
              cIdx === col ? ("unchecked" as CellCheckState) : c
            )
          : r
      );
      setCellCheckGrid(newCheckGrid);
    }
    if (upperValue !== "" && activeWord) {
      const nextEmptyCell = findNextEditableCell(activeWord, { row, col });
      if (nextEmptyCell) {
        setActiveCell(nextEmptyCell);
      } else {
        moveToNextCell();
      }
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (crosswordData.solutionGrid[row][col] === null) return;
    const isSameCell = activeCell?.row === row && activeCell?.col === col;
    let newDirection = activeDirection;
    if (isSameCell) {
      newDirection = activeDirection === "ACROSS" ? "DOWN" : "ACROSS";
      if (!findWordAtCell({ row, col }, newDirection)) {
        newDirection = activeDirection;
      }
    }
    setActiveCell({ row, col });
    setActiveDirection(newDirection);
  };

  const handleClueSelect = (word: WordDefinition) => {
    const firstEmpty = findNextEditableCell(word, { row: -1, col: -1 }, true);
    setActiveDirection(word.orientation);
    setActiveCell(firstEmpty || word.startPosition);
  };

  const getCluesByDirection = (direction: Orientation) => {
    return crosswordData.words
      .filter((w) => w.orientation === direction)
      .sort((a, b) => a.id - b.id);
  };

  const handleClueNavigation = (forward: boolean) => {
    if (!activeWord) return;
    const currentClues = getCluesByDirection(activeDirection);
    const currentIndex = currentClues.findIndex((w) => w.id === activeWord.id);
    if (currentIndex !== -1) {
      const nextIndex =
        (currentIndex + (forward ? 1 : -1) + currentClues.length) %
        currentClues.length;
      handleClueSelect(currentClues[nextIndex]);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (isPuzzleSolved) return;
    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
      startTimer();
      return;
    }
    event.preventDefault();
    switch (event.key) {
      case "ArrowUp":
        setActiveDirection("DOWN");
        moveToPrevCell();
        break;
      case "ArrowDown":
        setActiveDirection("DOWN");
        moveToNextCell();
        break;
      case "ArrowLeft":
        setActiveDirection("ACROSS");
        moveToPrevCell();
        break;
      case "ArrowRight":
        setActiveDirection("ACROSS");
        moveToNextCell();
        break;
      case "Backspace":
        startTimer();
        if (userGrid?.[row]?.[col]) {
          handleCellChange(row, col, "");
        } else {
          moveToPrevCell();
        }
        break;
      case "Enter":
      case " ":
        handleCellClick(row, col);
        break;
      default:
        break;
    }
  };

  const handleOnScreenKeyPress = (key: string) => {
    if (!activeCell || isPuzzleSolved) return;
    startTimer();
    if (key === "BACKSPACE") {
      if (userGrid?.[activeCell.row]?.[activeCell.col]) {
        handleCellChange(activeCell.row, activeCell.col, "");
      } else {
        moveToPrevCell();
      }
    } else {
      handleCellChange(activeCell.row, activeCell.col, key);
    }
  };

  const handleCheckPuzzle = () => {
    if (!userGrid) return;
    const newCheckGrid = userGrid.map((row, rIdx) =>
      row.map((cell, cIdx) => {
        if (crosswordData.solutionGrid[rIdx][cIdx] === null) return null;
        if (!cell) return "unchecked";
        return cell.toUpperCase() === crosswordData.solutionGrid[rIdx][cIdx]
          ? "correct"
          : "incorrect";
      })
    );
    setCellCheckGrid(newCheckGrid);
  };

  const handleRevealWord = () => {
    if (!activeWord || !userGrid || !cellCheckGrid) return;
    startTimer();
    let newUserGrid = [...userGrid];
    let newCheckGrid = [...cellCheckGrid];
    for (let i = 0; i < activeWord.length; i++) {
      let r = activeWord.startPosition.row;
      let c = activeWord.startPosition.col;
      if (activeWord.orientation === "ACROSS") c += i;
      else r += i;
      if (r < crosswordData.gridSize && c < crosswordData.gridSize) {
        newUserGrid[r] = [...newUserGrid[r]];
        newUserGrid[r][c] = crosswordData.solutionGrid[r][c];
        newCheckGrid[r] = [...newCheckGrid[r]];
        newCheckGrid[r][c] = "correct";
      }
    }
    setUserGrid(newUserGrid);
    setCellCheckGrid(newCheckGrid);
  };

  const handleRevealPuzzle = () => {
    startTimer();
    setUserGrid(crosswordData.solutionGrid.map((r) => [...r]));
    setCellCheckGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? "correct" : null))
      )
    );
    setIsPuzzleSolved(true);
  };

  const handleClearPuzzle = () => {
    setUserGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? "" : null))
      )
    );
    setCellCheckGrid(
      crosswordData.solutionGrid.map((row) =>
        row.map((cell) => (cell ? ("unchecked" as CellCheckState) : null))
      )
    );
    setIsPuzzleSolved(false);
    setTime(0);
    setIsTimerRunning(false);
  };

  if (!activeCell)
    return (
      <div className="flex justify-center items-center h-screen">
        Initializing...
      </div>
    );

  return (
    <div className="w-screen h-dvh bg-gray-50 flex flex-col">
      <header ref={headerRef} className="main-header text-center py-2 px-2 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700 tracking-tight">
          Dodo Krossword
        </h1>
        <p className="text-base text-gray-600 mt-1 hidden sm:block">
          {crosswordData.title}
        </p>
        {error && (
          <p className="text-sm text-red-500 mt-1 bg-red-100 p-1 rounded-md shadow">
            Note: {error}
          </p>
        )}
      </header>

      {isMobile ? (
        <main
          ref={mobileMainRef}
          // --- THE FIX ---
          // from old code
          className="flex-grow grid grid-rows-[auto,1fr,auto] gap-2 px-2 pb-2 min-h-0"
        >
          <div className="w-full flex justify-center flex-shrink-0">
            <Timer time={time} />
          </div>

          <div
            ref={mobileGridContainerRef}
            // ADDED 'mt-2' to restore visual spacing
            className="w-full flex-1 flex items-center justify-center min-h-0 mt-2"
          >
            <CrosswordGrid
              crosswordData={crosswordData}
              userGrid={userGrid}
              activeCell={activeCell}
              activeDirection={activeDirection}
              cellCheckGrid={cellCheckGrid}
              onCellChange={handleCellChange}
              onCellClick={handleCellClick}
              onCellKeyDown={handleKeyDown}
              isMobile={isMobile}
            />
          </div>

          <footer
            ref={mobileFooterRef}
            // ADDED 'mt-2' to restore visual spacing
            className="w-full flex flex-col gap-2 flex-shrink-0 mt-2"
          >
            <ClueBar
              activeWord={activeWord}
              activeDirection={activeDirection}
              onPrevClue={() => handleClueNavigation(false)}
              onNextClue={() => handleClueNavigation(true)}
            />
            <OnScreenKeyboard
              onKeyPress={handleOnScreenKeyPress}
              onCheckPuzzle={handleCheckPuzzle}
              onRevealWord={handleRevealWord}
              onRevealPuzzle={handleRevealPuzzle}
              onClearPuzzle={handleClearPuzzle}
              isPuzzleSolved={isPuzzleSolved}
            />
          </footer>
        </main>
      ) : (
        <main className="flex flex-col lg:flex-row gap-4 md:gap-6 items-start justify-center flex-grow p-4 overflow-y-auto">
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
              onCellClick={handleCellClick}
              onCellKeyDown={handleKeyDown}
              isMobile={isMobile}
            />
            <Toolbar
              onCheckPuzzle={handleCheckPuzzle}
              onRevealWord={handleRevealWord}
              onRevealPuzzle={handleRevealPuzzle}
              onClearPuzzle={handleClearPuzzle}
              isPuzzleSolved={isPuzzleSolved}
            />
          </div>
          <div className="w-full lg:flex-1 bg-white p-3 rounded-lg shadow-md overflow-y-auto">
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
                Congratulations! You solved the puzzle in{" "}
                {Math.floor(time / 60)}m {time % 60}s!
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
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const today = getTodayDateString();
      const cachedPuzzleKey = `crossword_${today}`;
      try {
        const cachedItem = localStorage.getItem(cachedPuzzleKey);
        if (cachedItem) {
          const parsedCache: CachedCrossword = JSON.parse(cachedItem);
          if (parsedCache.date === today && parsedCache.data) {
            setCrosswordData(parsedCache.data);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse cache, clearing it.", e);
        localStorage.clear();
      }
      try {
        const data = await fetchPreGeneratedCrossword(today);
        setCrosswordData(data);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("crossword_")) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem(
          cachedPuzzleKey,
          JSON.stringify({ date: today, data })
        );
      } catch (err) {
        try {
          console.warn(
            `Could not load puzzle for ${today}, falling back to sample.`
          );
          const sampleData = await fetchPreGeneratedCrossword(
            SAMPLE_PUZZLE_DATE_STRING
          );
          setCrosswordData(sampleData);
          setError(
            `Today's puzzle (${today}) was not found. Displaying a sample puzzle.`
          );
        } catch (sampleErr) {
          setError("Failed to load any puzzles. Please try again later.");
          console.error(
            "Critical: Failed to load even the sample puzzle.",
            sampleErr
          );
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (crosswordData) {
        const today = getTodayDateString();
        const titleDate = crosswordData.title.split(" - ")[1];
        if (titleDate && titleDate !== today) {
          console.log(
            `New day detected! Puzzle date is ${titleDate}, today is ${today}. Reloading page.`
          );
          window.location.reload();
        }
      }
    }, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, [crosswordData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen text-xl text-gray-700">
        Loading Daily Dodo Krossword...
      </div>
    );
  }
  if (error && !crosswordData) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-600 p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Error Loading Puzzle</h2>
        <p className="text-sm text-gray-700">{error}</p>
      </div>
    );
  }
  if (crosswordData) {
    return <CrosswordGame initialData={crosswordData} error={error} />;
  }
  return (
    <div className="flex justify-center items-center h-screen text-xl text-red-700">
      Something went wrong.
    </div>
  );
};

export default App;
