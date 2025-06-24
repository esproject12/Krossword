// This is the final version with Markdown fence cleanup restored.
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

function buildPuzzle(template, filledSlots, date) {
  const gridSize = template.length;
  const solutionGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  let words = [];
  const slotMap = new Map();
  findSlots(template).forEach((slot) => {
    const key = `${slot.orientation}-${slot.start.row}-${slot.start.col}`;
    slotMap.set(key, { id: slot.id });
  });

  // Validate that all answers fit their slots and build the grid
  const tempGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  for (const filled of filledSlots) {
    if (filled.answer.length !== filled.length) {
      throw new Error(
        `AI returned word "${filled.answer}" with length ${filled.answer.length} for a slot of length ${filled.length}.`
      );
    }
    let { row, col } = filled.start;
    for (const char of filled.answer) {
      if (tempGrid[row][col] && tempGrid[row][col] !== char) {
        throw new Error(
          `Intersection conflict at [${row},${col}] for word "${filled.answer}".`
        );
      }
      tempGrid[row][col] = char;
      if (filled.orientation === "ACROSS") col++;
      else row++;
    }
  }

  // If validation passes, build the final puzzle object
  for (const filled of filledSlots) {
    const key = `${filled.orientation}-${filled.start.row}-${filled.start.col}`;
    const slotInfo = slotMap.get(key);
    if (slotInfo) {
      words.push({ ...filled, id: slotInfo.id });
      const { answer, start, orientation } = filled;
      let { row, col } = start;
      for (const char of answer) {
        if (row < gridSize && col < gridSize) {
          solutionGrid[row][col] = char;
          if (orientation === "ACROSS") col++;
          else row++;
        }
      }
    }
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (template[r][c] === "0") {
        solutionGrid[r][c] = null;
      }
    }
  }

  return {
    gridSize,
    title: `Indian Mini Crossword - ${date}`,
    words,
    solutionGrid,
  };
}

async function generateCrosswordWithGemini(slots, yesterdaysWords = []) {
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
    You are an expert crossword puzzle filler. Your task is to fill the following word slots with India-themed words and provide a clever clue for each.
    All words must be in English.
    
    Word Slots to fill:
    ${JSON.stringify(
      slots.map((s) => ({
        orientation: s.orientation,
        length: s.length,
        start: s.start,
      })),
      null,
      2
    )}
    
    Your response MUST be a valid JSON array of objects. Each object must represent a filled slot and have the properties "answer", "clue", "orientation", and "start".
    Example response format:
    [
      {
        "answer": "PANEER",
        "clue": "A type of Indian cheese",
        "orientation": "ACROSS",
        "start": { "row": 0, "col": 0 },
        "length": 6
      }
    ]
    
    Constraints:
    1. The 'answer' for each object MUST exactly match the 'length' required by its corresponding slot.
    2. The entire response MUST be a single, valid JSON array, without any markdown fences like \`\`\`json.
    3. All words must interlock correctly. Ensure that if a letter is shared between an ACROSS and DOWN word, it is the same letter.
    4. ${uniquenessInstruction}
  `;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.9,
    },
  });

  if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Failed to get a valid text part from Gemini response.");
  }

  let jsonStr = result.candidates[0].content.parts[0].text.trim();

  // Restore the markdown fence cleanup logic
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    console.log("Found and removed Markdown fences.");
    jsonStr = match[1].trim();
  }

  const filledSlots = JSON.parse(jsonStr);

  if (!Array.isArray(filledSlots)) {
    throw new Error("AI response was not a JSON array.");
  }

  return filledSlots;
}

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
        const filledSlots = await generateCrosswordWithGemini(
          slots,
          yesterdaysWords
        );
        finalPuzzleData = buildPuzzle(chosenTemplate, filledSlots, todayStr);
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
    fs.writeFileSync(puzzlePath, JSON.stringify(finalPuzzleData, null, 2));
    console.log(`Successfully saved new puzzle to ${puzzlePath}`);
  }
}

generateAndSave();
