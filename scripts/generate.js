// This is a self-contained script.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// --- Configuration ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const EXPECTED_GRID_SIZE = 6;

// --- TIMEZONE-AWARE DATE FUNCTION ---
const getTodayDateString = () => {
  // Create a date object based on current time
  const now = new Date();
  // Convert it to an IST-specific string (UTC+5:30)
  // toLocaleString is a standard way to get timezone-specific dates
  const istDateString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  // Create a new date object from this IST string to avoid timezone-offset issues
  const istDate = new Date(istDateString);
  // Format it into YYYY-MM-DD
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// --- Main Generation Logic ---
async function generateCrosswordWithGemini() {
  const apiKey = process.env.GEMINI_API_KEY_FROM_SECRET;
  if (!apiKey) {
    throw new Error(
      "CRITICAL: GEMINI_API_KEY_FROM_SECRET is not set in the environment."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const today = getTodayDateString(); // This will now correctly get the IST date

  const prompt = `
    You are a crossword puzzle creator.
    Create a 6x6 crossword puzzle for the date ${today}. The theme must be related to India.
    The puzzle must be valid, fully-interlocking, and have a reasonable density of words.
    Provide the output as a single JSON object. The JSON must strictly follow this structure:
    {
      "gridSize": 6,
      "title": "Indian Mini Crossword - ${today}",
      "words": [],
      "solutionGrid": []
    }
    Key requirements:
    1. Grid size MUST be exactly 6x6.
    2. 'words' array MUST contain all words placed and not be empty.
    3. 'answer' must be all uppercase and match 'solutionGrid'.
    4. 'startPosition' is 0-indexed {row, col}.
    5. 'solutionGrid' MUST be a 6x6 array.
    `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.85,
    },
  });

  if (
    !result ||
    !result.candidates ||
    !result.candidates[0] ||
    !result.candidates[0].content ||
    !result.candidates[0].content.parts ||
    !result.candidates[0].content.parts[0] ||
    !result.candidates[0].content.parts[0].text
  ) {
    console.error(
      "Unexpected response structure from Gemini API:",
      JSON.stringify(result, null, 2)
    );
    throw new Error(
      "Failed to get a valid text part from the Gemini API response."
    );
  }

  let jsonStr = result.candidates[0].content.parts[0].text.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  const data = JSON.parse(jsonStr);

  if (
    !data ||
    data.gridSize !== EXPECTED_GRID_SIZE ||
    !data.solutionGrid ||
    data.solutionGrid.length !== EXPECTED_GRID_SIZE ||
    !data.words ||
    data.words.length === 0
  ) {
    throw new Error(`Validation failed for generated puzzle.`);
  }
  console.log(
    `Validation passed: Received a ${data.gridSize}x${data.gridSize} puzzle with ${data.words.length} words.`
  );
  data.words.forEach((word) => (word.answer = word.answer.toUpperCase()));
  data.solutionGrid.forEach((row) => {
    if (row) {
      row.forEach((cell, i) => {
        if (typeof cell === "string") row[i] = cell.toUpperCase();
      });
    }
  });
  return data;
}

// --- File Saving Logic ---
async function generateAndSave() {
  const today = getTodayDateString(); // This will get the correct IST date
  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${today}.json`);

  if (!fs.existsSync(puzzleDir)) {
    fs.mkdirSync(puzzleDir, { recursive: true });
  }

  if (fs.existsSync(puzzlePath)) {
    console.log(
      `Puzzle for ${today} (IST) already exists. Skipping generation.`
    );
    return;
  }

  console.log(`Generating new puzzle for ${today} (IST)...`);
  try {
    const crosswordData = await generateCrosswordWithGemini();
    fs.writeFileSync(puzzlePath, JSON.stringify(crosswordData, null, 2));
    console.log(`Successfully generated and saved puzzle to ${puzzlePath}`);
  } catch (error) {
    console.error("Failed to generate crossword puzzle:", error);
    process.exit(1);
  }
}

generateAndSave();
