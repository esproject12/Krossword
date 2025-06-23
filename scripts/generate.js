// This is a self-contained script with correct date logic for uniqueness.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// --- Configuration ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const EXPECTED_GRID_SIZE = 6;
const MAX_RETRIES = 3;
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";

// --- Validation Functions ---
function validatePuzzleLogic(data) {
  console.log("Performing logic-based validation...");
  const { gridSize, words, solutionGrid: geminiGrid } = data;
  const localGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  for (const word of words) {
    const { answer, startPosition, orientation } = word;
    if (!answer || !startPosition)
      throw new Error(
        `Validation Error: Invalid word object: ${JSON.stringify(word)}`
      );
    let { row, col } = startPosition;
    for (let i = 0; i < answer.length; i++) {
      const char = answer[i];
      if (row >= gridSize || col >= gridSize)
        throw new Error(
          `Validation Error: Word "${answer}" goes out of bounds.`
        );
      if (localGrid[row][col] !== null && localGrid[row][col] !== char)
        throw new Error(
          `Validation Error: Conflict at (${row},${col}). Word "${answer}" wants '${char}', grid has '${localGrid[row][col]}'.`
        );
      localGrid[row][col] = char;
      if (orientation === "ACROSS") col++;
      else row++;
    }
  }
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const localCell = localGrid[r][c] || null;
      const geminiCell = geminiGrid[r][c] || null;
      if (localCell !== geminiCell)
        throw new Error(
          `Validation Error: Grid mismatch at (${r},${c}). Local:'${localCell}', Gemini:'${geminiCell}'.`
        );
    }
  }
  console.log("Logic-based validation successful!");
  return true;
}

function validateBasicStructure(data) {
  if (!data) throw new Error("Validation failed: Data is null.");
  if (data.gridSize !== EXPECTED_GRID_SIZE)
    throw new Error(`Validation failed: gridSize is ${data.gridSize}.`);
  if (
    !Array.isArray(data.solutionGrid) ||
    data.solutionGrid.length !== EXPECTED_GRID_SIZE
  )
    throw new Error(
      `Validation failed: solutionGrid is not ${EXPECTED_GRID_SIZE} rows.`
    );
  for (const row of data.solutionGrid) {
    if (!Array.isArray(row) || row.length !== EXPECTED_GRID_SIZE)
      throw new Error(
        `Validation failed: A row is not ${EXPECTED_GRID_SIZE} columns.`
      );
  }
  if (!Array.isArray(data.words) || data.words.length === 0)
    throw new Error("Validation failed: 'words' array is empty.");
  for (const word of data.words) {
    if (
      !word.id ||
      !word.clue ||
      !word.answer ||
      !word.orientation ||
      !word.startPosition
    )
      throw new Error(
        `Validation failed: A word object is missing properties.`
      );
  }
  console.log(`Basic structure validation passed.`);
  return true;
}

async function selfCorrectJson(ai, brokenJson) {
  console.log("Attempting to self-correct invalid JSON...");
  const correctionPrompt = `The following text is supposed to be a single, valid JSON object, but it has a syntax error. Please fix it and return only the corrected, valid JSON object with no other text or markdown fences.\n\nInvalid JSON:\n${brokenJson}`;
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: correctionPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.0,
    },
  });
  if (!result?.candidates?.[0]?.content?.parts?.[0]?.text)
    throw new Error("Self-correction failed: Invalid response.");
  console.log("Self-correction successful, re-parsing...");
  return result.candidates[0].content.parts[0].text.trim();
}

// --- Main Generation Logic with Uniqueness ---
async function generateCrosswordWithGemini(yesterdaysWords = []) {
  const apiKey = process.env.GEMINI_API_KEY_FROM_SECRET;
  if (!apiKey)
    throw new Error("CRITICAL: GEMINI_API_KEY_FROM_SECRET is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().split("T")[0];

  let uniquenessInstruction = "";
  if (yesterdaysWords.length > 0) {
    uniquenessInstruction = `\n    9. CRITICAL REQUIREMENT: The puzzle MUST be completely new. Do NOT use any of these words as answers: ${yesterdaysWords.join(
      ", "
    )}.`;
  }

  const prompt = `
    You are a crossword puzzle creator.
    Create a 6x6 crossword puzzle for the date ${today}. The theme must be related to India.
    The puzzle must be valid, fully-interlocking, and have a reasonable density of words.
    Provide the output as a single JSON object. The JSON must strictly follow this structure:
    {
      "gridSize": 6,
      "title": "Indian Mini Crossword - ${today}",
      "words": [
        { "id": 1, "clue": "Example clue", "answer": "EXAMPLE", "orientation": "ACROSS", "startPosition": {"row": 0, "col": 0}, "length": 7 }
      ],
      "solutionGrid": []
    }
    Key requirements:
    1. gridSize MUST be exactly 6.
    2. 'words' array MUST contain all words placed and MUST NOT be empty.
    3. Every object in the 'words' array MUST have all properties: id, clue, answer, orientation, startPosition, length.
    4. 'solutionGrid' MUST be a 6x6 array and accurately represent the solved puzzle.
    ${uniquenessInstruction}
    `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.9,
    },
  });

  if (!result?.candidates?.[0]?.content?.parts[0]?.text)
    throw new Error("Failed to get a valid text part from Gemini.");

  let jsonStr = result.candidates[0].content.parts[0].text.trim();
  let data;
  try {
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[1]) jsonStr = match[1].trim();
    data = JSON.parse(jsonStr);
  } catch (error) {
    console.warn("Initial JSON.parse failed. Error:", error.message);
    const correctedJsonStr = await selfCorrectJson(ai, jsonStr);
    data = JSON.parse(correctedJsonStr);
  }
  validateBasicStructure(data);
  validatePuzzleLogic(data);
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

// --- File Saving Logic with CORRECTED Date Logic ---
async function generateAndSave() {
  const now = new Date();
  const istDateString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  const istDate = new Date(istDateString);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${todayStr}.json`);
  const samplePuzzlePath = path.join(puzzleDir, SAMPLE_PUZZLE_FILENAME);

  if (fs.existsSync(puzzlePath)) {
    console.log(`A puzzle for ${todayStr} (IST) already exists. Skipping.`);
    return;
  }

  // NEW: Read yesterday's puzzle to ensure uniqueness
  let yesterdaysWords = [];
  try {
    const yesterday = new Date(istDate); // Start with today's IST date
    yesterday.setDate(istDate.getDate() - 1); // Correctly subtract one day

    const y_year = yesterday.getFullYear();
    const y_month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const y_day = String(yesterday.getDate()).padStart(2, "0");
    const yesterdayFilename = `${y_year}-${y_month}-${y_day}.json`;
    const yesterdayPath = path.join(puzzleDir, yesterdayFilename);

    if (fs.existsSync(yesterdayPath)) {
      const yesterdayData = JSON.parse(fs.readFileSync(yesterdayPath, "utf-8"));
      if (yesterdayData.words) {
        yesterdaysWords = yesterdayData.words.map((w) => w.answer);
        console.log(
          "Found yesterday's words to avoid:",
          yesterdaysWords.join(", ")
        );
      }
    } else {
      console.log(
        `No puzzle found for yesterday (${yesterdayFilename}). Generating a new puzzle without uniqueness constraints.`
      );
    }
  } catch (e) {
    console.warn(
      "Could not read or parse yesterday's puzzle. Proceeding without uniqueness constraint.",
      e.message
    );
  }

  let crosswordData = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(
      `--- Generating puzzle for ${todayStr} (IST) - Attempt ${attempt}/${MAX_RETRIES} ---`
    );
    try {
      crosswordData = await generateCrosswordWithGemini(yesterdaysWords);
      console.log(
        `Successfully generated and validated a new puzzle on attempt ${attempt}.`
      );
      break;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      crosswordData = null;
      if (attempt === MAX_RETRIES) {
        console.error("All AI generation attempts failed.");
      }
    }
  }

  if (!crosswordData) {
    console.log("Resorting to fallback: copying sample puzzle.");
    try {
      if (!fs.existsSync(samplePuzzlePath)) {
        throw new Error(
          `CRITICAL: Sample puzzle file not found at ${samplePuzzlePath}`
        );
      }
      const sampleData = fs.readFileSync(samplePuzzlePath, "utf-8");
      const puzzleJson = JSON.parse(sampleData);

      puzzleJson.title = `Indian Mini Crossword - ${todayStr}`;

      fs.writeFileSync(puzzlePath, JSON.stringify(puzzleJson, null, 2));
      console.log(
        `Successfully used sample puzzle as fallback for ${todayStr}.`
      );
    } catch (fallbackError) {
      console.error(
        "CRITICAL: Failed to use the fallback puzzle.",
        fallbackError
      );
      process.exit(1);
    }
  } else {
    fs.writeFileSync(puzzlePath, JSON.stringify(crosswordData, null, 2));
    console.log(`Successfully generated and saved new puzzle to ${puzzlePath}`);
  }
}

generateAndSave();
