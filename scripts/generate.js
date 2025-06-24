// Final version optimized for API rate limits by using a single, powerful prompt.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_RETRIES = 5;
const MINIMUM_WORDS = 8;

// --- TEMPLATE-BASED LOGIC ---
function findSlots(template) {
  const slots = [];
  const size = template.length;
  const numberGrid = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  let id = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (template[r][c] === "0") continue;
      const isAcrossStart = c === 0 || template[r][c - 1] === "0";
      const isDownStart = r === 0 || template[r - 1][c] === "0";
      if (isAcrossStart || isDownStart) {
        numberGrid[r][c] = id++;
      }
    }
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (template[r][c] === "0") continue;
      const isAcrossStart = c === 0 || template[r][c - 1] === "0";
      const isDownStart = r === 0 || template[r - 1][c] === "0";
      if (isAcrossStart) {
        let length = 0;
        while (c + length < size && template[r][c + length] === "1") length++;
        if (length > 2)
          slots.push({
            id: numberGrid[r][c],
            orientation: "ACROSS",
            start: { row: r, col: c },
            length,
          });
      }
      if (isDownStart) {
        let length = 0;
        while (r + length < size && template[r + length][c] === "1") length++;
        if (length > 2)
          slots.push({
            id: numberGrid[r][c],
            orientation: "DOWN",
            start: { row: r, col: c },
            length,
          });
      }
    }
  }
  return slots;
}

function validatePuzzleLogic(data) {
  console.log("Performing logic-based validation...");
  const { gridSize, words, solutionGrid: geminiGrid } = data;
  if (
    !data ||
    !gridSize ||
    gridSize !== 6 ||
    !geminiGrid ||
    geminiGrid.length !== 6
  ) {
    throw new Error(
      "Basic puzzle structure (gridSize, solutionGrid) is invalid."
    );
  }

  const localGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  for (const word of words) {
    const { answer, startPosition, orientation } = word;
    if (!answer || !startPosition)
      throw new Error(`Invalid word object: ${JSON.stringify(word)}`);
    let { row, col } = startPosition;
    for (let i = 0; i < answer.length; i++) {
      const char = answer[i];
      if (row >= gridSize || col >= gridSize)
        throw new Error(`Word "${answer}" goes out of bounds.`);
      if (localGrid[row][col] && localGrid[row][col] !== char)
        throw new Error(`Conflict at [${row},${col}] for word "${answer}".`);
      localGrid[row][col] = char;
      if (orientation === "ACROSS") col++;
      else row++;
    }
  }
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const localCell = localGrid[r][c];
      const geminiCell = geminiGrid[r][c];
      if ((localCell || null) !== (geminiCell || null))
        throw new Error(`Grid mismatch at [${r},${c}].`);
    }
  }
  console.log("Logic-based validation successful!");
  return true;
}

// --- MAIN GENERATION LOGIC (SINGLE SHOT) ---
async function generateSingleShotCrossword(slots, yesterdaysWords = []) {
  const apiKey = process.env.GEMINI_API_KEY_FROM_SECRET;
  if (!apiKey) throw new Error("CRITICAL: API_KEY is not set.");
  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().split("T")[0];

  const uniquenessInstruction =
    yesterdaysWords.length > 0
      ? `Crucially, do NOT use any of these words: ${yesterdaysWords.join(
          ", "
        )}.`
      : "";

  const prompt = `
    You are an expert crossword puzzle creator. Your task is to generate a complete, valid, and interlocking set of words and clues for the provided puzzle grid structure.
    
    The puzzle grid is 6x6. Here are the exact word slots you must fill:
    ${JSON.stringify(
      slots.map((s) => ({
        orientation: s.orientation,
        length: s.length,
        start: s.start,
      })),
      null,
      2
    )}

    Your response MUST be a single, valid JSON object with the following structure:
    {
      "gridSize": 6,
      "title": "Indian Mini Crossword - ${today}",
      "words": [
        { "id": 1, "clue": "...", "answer": "...", "orientation": "...", "startPosition": {...}, "length": ... }
      ],
      "solutionGrid": [ ["C", "R", "I", "C", "K", "E"], ["I", null, ...], ... ]
    }

    CRITICAL REQUIREMENTS:
    1. The "words" array MUST contain an entry for every slot provided above.
    2. The "answer" for each word MUST exactly match its specified length and fit the grid.
    3. The "solutionGrid" MUST be a 6x6 array and be logically consistent with all the answers in the "words" array. All intersections must match perfectly.
    4. All words and clues must be India-themed and in English.
    5. All answer words MUST be 6 letters long or less.
    6. ${uniquenessInstruction}
  `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.85,
    },
  });

  if (!result?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Failed to get a valid text part from Gemini response.");
  }

  let jsonStr = result.response.candidates[0].content.parts[0].text.trim();

  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  const data = JSON.parse(jsonStr);
  validatePuzzleLogic(data);
  return data;
}

// --- FILE SAVING AND RETRY LOGIC ---
async function generateAndSave() {
  const now = new Date();
  const istDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const todayStr = `${istDate.getFullYear()}-${String(
    istDate.getMonth() + 1
  ).padStart(2, "0")}-${String(istDate.getDate()).padStart(2, "0")}`;

  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${todayStr}.json`);
  const samplePuzzlePath = path.join(puzzleDir, SAMPLE_PUZZLE_FILENAME);

  if (fs.existsSync(puzzlePath)) {
    console.log(`Puzzle for ${todayStr} already exists. Skipping.`);
    return;
  }

  let chosenTemplate = null;
  let slots = [];
  let templateTries = 0;

  while (!chosenTemplate && templateTries < templates.length * 2) {
    const tempTemplate =
      templates[Math.floor(Math.random() * templates.length)];
    const tempSlots = findSlots(tempTemplate);
    if (tempSlots.length >= MINIMUM_WORDS) {
      chosenTemplate = tempTemplate;
      slots = tempSlots;
      console.log(
        `Selected a template with ${slots.length} words (>=${MINIMUM_WORDS} required).`
      );
    }
    templateTries++;
  }

  if (!chosenTemplate) {
    console.error(
      `Could not find a suitable template with at least ${MINIMUM_WORDS} words.`
    );
  }

  let yesterdaysWords = [];
  try {
    const yesterday = new Date(istDate);
    yesterday.setDate(istDate.getDate() - 1);
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
    }
  } catch (e) {
    console.warn("Could not read yesterday's puzzle.", e.message);
  }

  let finalPuzzleData = null;

  if (chosenTemplate) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(
        `--- Generating puzzle for ${todayStr} - Attempt ${attempt}/${MAX_RETRIES} ---`
      );
      try {
        const puzzleData = await generateSingleShotCrossword(
          slots,
          yesterdaysWords
        );
        finalPuzzleData = puzzleData;
        console.log(
          `Successfully generated and validated a new puzzle on attempt ${attempt}.`
        );
        break;
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);
        if (attempt === MAX_RETRIES) {
          console.error("All AI generation attempts failed.");
        }
      }
    }
  }

  if (!finalPuzzleData) {
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
    // Normalize data just before saving
    finalPuzzleData.words.forEach(
      (word) => (word.answer = word.answer.toUpperCase())
    );
    finalPuzzleData.solutionGrid.forEach((row) => {
      if (row) {
        row.forEach((cell, i) => {
          if (typeof cell === "string") row[i] = cell.toUpperCase();
        });
      }
    });
    fs.writeFileSync(puzzlePath, JSON.stringify(finalPuzzleData, null, 2));
    console.log(`Successfully saved new puzzle to ${puzzlePath}`);
  }
}

generateAndSave();
