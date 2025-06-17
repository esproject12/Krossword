// This is a self-contained script.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// --- Configuration ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";

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
    Create a 6x6 crossword puzzle. The theme must be related to India (culture, common knowledge, places, food, etc.).
    The puzzle must be valid, fully-interlocking, and have a reasonable density of words.
    Provide the output as a single JSON object. The JSON must strictly follow this structure:
    {
      "gridSize": 6,
      "title": "Indian Mini Crossword - ${today}",
      "words": [],
      "solutionGrid": []
    }
    Key requirements:
    1. Grid size must be 6x6.
    2. 'words' array must contain all words placed. Each word must have a unique 'id'.
    3. 'answer' must be all uppercase and match the letters in 'solutionGrid'.
    4. 'startPosition' is 0-indexed {row, col}.
    5. 'solutionGrid' must be a 6x6 array and accurately represent the solved puzzle, with 'null' for black squares.
    6. The puzzle must be solvable and logical. Answers should be single words.
    7. Generate a unique puzzle for the date ${today}.
    8. Focus on common and recognizable words related to India.
    `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.8,
    },
  });

  // --- THIS IS THE CORRECTED LOGIC ---
  // Based on the successful log output, we now know the exact path to the text.
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
  // --- END OF CORRECTED LOGIC ---

  // Clean up markdown fences if they exist
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  const data = JSON.parse(jsonStr);

  // Final validation
  if (!data || !data.words || !data.solutionGrid) {
    throw new Error("Invalid data structure received from Gemini API.");
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
}

// --- File Saving Logic ---
async function generateAndSave() {
  const today = new Date().toISOString().split("T")[0];
  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${today}.json`);

  if (!fs.existsSync(puzzleDir)) {
    fs.mkdirSync(puzzleDir, { recursive: true });
  }

  if (fs.existsSync(puzzlePath)) {
    console.log(`Puzzle for ${today} already exists. Skipping generation.`);
    return;
  }

  console.log(`Generating new puzzle for ${today}...`);
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
