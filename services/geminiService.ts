import { GoogleGenAI, GenerateContentResult } from "@google/genai";
import type { CrosswordData } from "../types";
import { GEMINI_MODEL_NAME } from "../constants";

// This API Key and AI instance is now primarily for the backend generation process.
// The client-side will fetch static JSONs.
const EFFECTIVE_API_KEY = process.env.API_KEY;

const getTodayDateStringInternal = (): string => {
  // Renamed to avoid conflict if imported elsewhere
  return new Date().toISOString().split("T")[0];
};

const API_TIMEOUT_MS = 120000; // 120 seconds timeout

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutError = new Error("API call timed out")
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(timeoutError);
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// This function is intended to be used by a backend/scheduled task for daily puzzle generation.
export const generateCrosswordWithGemini = async (): Promise<CrosswordData> => {
  if (
    !EFFECTIVE_API_KEY ||
    EFFECTIVE_API_KEY === "YOUR_GEMINI_API_KEY_HERE_IF_NO_ENV_VAR"
  ) {
    const errorMsg =
      "Gemini API Key is not configured for generation. Please set the GEMINI_API_KEY (or API_KEY) environment variable in the generation environment.";
    console.error(errorMsg);
    // For a backend function, this error should be handled appropriately, e.g., logging and exiting.
    if (typeof window !== "undefined") {
      // Only show alert if in a browser context (though this fn is for backend)
      alert(
        "CRITICAL: API Key for generation is missing. Backend process will fail."
      );
    }
    throw new Error(errorMsg);
  }

  // Initialize AI client here, only when needed for actual generation
  const ai = new GoogleGenAI({ apiKey: EFFECTIVE_API_KEY });
  const today = getTodayDateStringInternal();
  // --- PROMPT UPDATED FOR 6x6 ---
  const prompt = `
    You are a crossword puzzle creator.
    Create a 6x6 crossword puzzle. The theme must be related to India (culture, common knowledge, places, food, etc.).
    The puzzle must be valid, fully-interlocking, and have a reasonable density of words.
    Provide the output as a single JSON object. The JSON must strictly follow this structure:
    {
      "gridSize": 6,
      "title": "Indian Mini Crossword - ${today}",
      "words": [
        {
          "id": 1, 
          "clue": "Example: Famous Indian monument", 
          "answer": "TAJMAHAL", 
          "orientation": "ACROSS", 
          "startPosition": { "row": 0, "col": 0 },
          "length": 8
        }
      ],
      "solutionGrid": [
        ["T", "A", "J", "M", "A", "H"],
        ["H", null, "A", null, "L", null],
        ["A", "N", "D", "H", "R", "A"],
        [null, "E", null, "A", null, null],
        ["S", "A", "R", "I", null, "L"],
        ["H", "I", "N", "D", "I", null]
      ]
    }

    Key requirements:
    1.  Grid size must be 6x6.
    2.  'words' array must contain all words placed. Each word must have a unique 'id'.
    3.  'answer' must be all uppercase and match the letters in 'solutionGrid'.
    4.  'startPosition' is 0-indexed {row, col}.
    5.  'solutionGrid' must be a 6x6 array and accurately represent the solved puzzle, with 'null' for black squares.
    6.  The puzzle must be solvable and logical. Answers should be single words.
    7.  Generate a unique puzzle for the date ${today}.
    8.  Focus on common and recognizable words related to India.
    `;

  try {
    const generateContentPromise = ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.8, // Slightly increased for more creativity in a larger grid
      },
    });

    const result: GenerateContentResult = await promiseWithTimeout(
      generateContentPromise,
      API_TIMEOUT_MS,
      new Error(
        `Failed to fetch crossword data from Gemini within ${
          API_TIMEOUT_MS / 1000
        } seconds.`
      )
    );

    let jsonStr = result.response.text().trim();
    // In case the model still wraps the JSON in markdown fences
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) {
      jsonStr = match[1].trim();
    }

    const data = JSON.parse(jsonStr) as CrosswordData;

    if (data && data.gridSize && data.words && data.solutionGrid) {
      if (data.gridSize !== 6) {
        console.warn(
          `Gemini returned a grid size of ${data.gridSize} instead of 6. This might cause issues.`
        );
      }
      data.words.forEach((word) => (word.answer = word.answer.toUpperCase()));
      data.solutionGrid.forEach((row) => {
        if (row) {
          row.forEach((cell, i) => {
            if (typeof cell === "string") row[i] = cell.toUpperCase();
          });
        }
      });
      return data;
    } else {
      throw new Error(
        "Invalid crossword data structure received from Gemini. Response: " +
          jsonStr.substring(0, 500)
      );
    }
  } catch (error) {
    console.error("Error generating crossword with Gemini:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to generate crossword puzzle via Gemini: ${message}`
    );
  }
};

// This function is for the client-side app to fetch pre-generated puzzles.
export const fetchPreGeneratedCrossword = async (
  dateString: string
): Promise<CrosswordData> => {
  const puzzleUrl = `/puzzles/${dateString}.json`;
  try {
    const response = await fetch(puzzleUrl);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Today's puzzle (${dateString}.json) not found. It might not be generated yet or the path is incorrect.`
        );
      }
      throw new Error(
        `Failed to fetch puzzle from ${puzzleUrl}. Status: ${response.status}`
      );
    }
    const data = (await response.json()) as CrosswordData;

    // Basic validation of fetched data
    if (data && data.gridSize && data.words && data.solutionGrid) {
      // Ensure answers and grid are uppercase (should be done by generator, but good fallback)
      data.words.forEach((word) => (word.answer = word.answer.toUpperCase()));
      data.solutionGrid.forEach((row) => {
        if (row) {
          row.forEach((cell, i) => {
            if (typeof cell === "string") row[i] = cell.toUpperCase();
          });
        }
      });
      return data;
    } else {
      console.error(
        "Fetched puzzle data is not in the expected CrosswordData format:",
        data
      );
      throw new Error(
        "Invalid puzzle data structure received from static file."
      );
    }
  } catch (error) {
    console.error(
      `Error fetching pre-generated crossword ${puzzleUrl}:`,
      error
    );
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message); // Re-throw the refined error message
  }
};
