// This is a self-contained script.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// --- Configuration ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const EXPECTED_GRID_SIZE = 6;

// --- NEW "PARANOID" VALIDATION FUNCTION ---
function validatePuzzleData(data) {
  if (!data) {
    throw new Error("Validation failed: Received data is null or undefined.");
  }
  if (data.gridSize !== EXPECTED_GRID_SIZE) {
    throw new Error(
      `Validation failed: Expected gridSize ${EXPECTED_GRID_SIZE}, but got ${data.gridSize}.`
    );
  }
  if (
    !Array.isArray(data.solutionGrid) ||
    data.solutionGrid.length !== EXPECTED_GRID_SIZE
  ) {
    throw new Error(
      `Validation failed: solutionGrid is not a ${EXPECTED_GRID_SIZE}-row array.`
    );
  }
  for (const row of data.solutionGrid) {
    if (!Array.isArray(row) || row.length !== EXPECTED_GRID_SIZE) {
      throw new Error(
        `Validation failed: A row in solutionGrid is not ${EXPECTED_GRID_SIZE} columns long.`
      );
    }
  }
  if (!Array.isArray(data.words) || data.words.length === 0) {
    throw new Error("Validation failed: 'words' array is missing or empty.");
  }
  for (const word of data.words) {
    if (
      !word.id ||
      !word.clue ||
      !word.answer ||
      !word.orientation ||
      !word.startPosition
    ) {
      throw new Error(
        `Validation failed: A word object is missing required properties. Received: ${JSON.stringify(
          word
        )}`
      );
    }
  }
  console.log(
    `Validation passed: Received a ${data.gridSize}x${data.gridSize} puzzle with ${data.words.length} complete word entries.`
  );
  return true;
}

// --- Main Generation Logic ---
async function generateCrosswordWithGemini() {
  const apiKey = process.env.GEMINI_API_KEY_FROM_SECRET;
  if (!apiKey) {
    throw new Error(
      "CRITICAL: GEMINI_API_KEY_FROM_SECRET is not set in the environment."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().split("T")[0];

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
    `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.9,
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

  // Run the new, strict validation
  validatePuzzleData(data);

  // Normalize data
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
  const today = new Date()
    .toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    .split(",")[0];
  const [month, day, year] = today.split("/");
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;

  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${todayStr}.json`);

  if (!fs.existsSync(puzzleDir)) {
    fs.mkdirSync(puzzleDir, { recursive: true });
  }

  // To allow for re-running the test, we will delete the file for today if it exists.
  // In production, the schedule only runs once, so this is safe.
  if (fs.existsSync(puzzlePath)) {
    console.log(
      `A puzzle for ${todayStr} already exists. Deleting it to generate a new one for this test run.`
    );
    fs.unlinkSync(puzzlePath);
  }

  console.log(`Generating new puzzle for ${todayStr} (IST)...`);
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
