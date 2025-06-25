// Final version with simplified AI task to avoid safety filters and local assembly.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_RETRIES = 5;
const MINIMUM_WORDS = 8;

// --- TEMPLATE LOGIC ---
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
      if (isAcrossStart || isDownStart) numberGrid[r][c] = id++;
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

// --- LOCAL PUZZLE ASSEMBLY AND VALIDATION ---
function assembleAndValidatePuzzle(template, wordList, date) {
  console.log("Attempting to assemble and validate puzzle locally...");
  const slots = findSlots(template);
  if (wordList.length !== slots.length) {
    throw new Error(
      `AI returned ${wordList.length} words, but template requires ${slots.length}.`
    );
  }

  let assignedSlots = [];
  let remainingWords = [...wordList];

  // Attempt to fit words into slots
  for (const slot of slots) {
    const wordIndex = remainingWords.findIndex(
      (w) => w.answer.length === slot.length
    );
    if (wordIndex === -1) {
      throw new Error(
        `Could not find a matching word for a slot of length ${slot.length}.`
      );
    }
    const word = remainingWords.splice(wordIndex, 1)[0];
    assignedSlots.push({ ...slot, ...word });
  }

  const gridSize = template.length;
  const solutionGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));

  // Check for intersection conflicts
  for (const word of assignedSlots) {
    let { row, col } = word.start;
    for (const char of word.answer.toUpperCase()) {
      if (solutionGrid[row][col] && solutionGrid[row][col] !== char) {
        throw new Error(
          `Intersection conflict at [${row},${col}] for word "${word.answer}".`
        );
      }
      solutionGrid[row][col] = char;
      if (word.orientation === "ACROSS") col++;
      else row++;
    }
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (template[r][c] === "0") {
        solutionGrid[r][c] = null;
      }
    }
  }

  console.log("Local assembly and validation successful!");
  return {
    gridSize,
    title: `Indian Mini Crossword - ${date}`,
    words: assignedSlots,
    solutionGrid,
  };
}

// --- MAIN GENERATION LOGIC ---
async function generateWordList(slots, yesterdaysWords = []) {
  const apiKey = process.env.GEMINI_API_KEY_FROM_SECRET;
  if (!apiKey) throw new Error("CRITICAL: API_KEY is not set.");
  const ai = new GoogleGenAI({ apiKey });

  const uniquenessInstruction =
    yesterdaysWords.length > 0
      ? `Crucially, do NOT use any of these words: ${yesterdaysWords.join(
          ", "
        )}.`
      : "";

  const prompt = `
    You are an expert crossword puzzle creator. Your task is to generate a list of interlocking, India-themed words and clues to fit a predefined 6x6 grid structure.

    Here are the required word slots. You must provide one word for each slot.
    ${JSON.stringify(
      slots.map((s) => ({ orientation: s.orientation, length: s.length })),
      null,
      2
    )}

    Your response MUST be a single, valid JSON array of objects. Each object must have an "answer" and a "clue".
    The number of objects in your array MUST exactly match the number of slots provided (${
      slots.length
    }).
    The length of each "answer" MUST match one of the required slot lengths.

    Example Response:
    [
        {"answer": "MUMBAI", "clue": "Financial capital of India"},
        {"answer": "DIWALI", "clue": "Festival of lights"}
    ]

    Constraints:
    1. All words must be India-themed and in English.
    2. All words must interlock logically to form a valid crossword puzzle.
    3. ${uniquenessInstruction}
  `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.9,
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

  return JSON.parse(jsonStr);
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
        const wordList = await generateWordList(slots, yesterdaysWords);
        finalPuzzleData = assembleAndValidatePuzzle(
          chosenTemplate,
          wordList,
          todayStr
        );
        console.log(
          `Successfully generated and built puzzle on attempt ${attempt}.`
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
    console.log("Resorting to fallback: using sample puzzle.");
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
    fs.writeFileSync(puzzlePath, JSON.stringify(finalPuzzleData, null, 2));
    console.log(`Successfully saved new puzzle to ${puzzlePath}`);
  }
}

generateAndSave();
