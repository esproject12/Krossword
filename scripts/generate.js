// Final version with corrected startPosition property name.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_RETRIES = 5;
const MINIMUM_WORDS = 8;
const API_DELAY_MS = 2500;

// --- HELPER FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- TEMPLATE LOGIC (Unchanged) ---
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

// --- LOGIC VALIDATION ---
function buildAndValidatePuzzle(template, filledSlots, date) {
  console.log("Attempting to assemble and validate puzzle locally...");
  const gridSize = template.length;
  const slots = findSlots(template);
  if (filledSlots.length !== slots.length) {
    throw new Error(
      `AI returned ${filledSlots.length} words, but template requires ${slots.length}.`
    );
  }

  let words = [];
  const tempGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));

  // First, map the AI's words to the correct slots
  let assignedSlots = [];
  let remainingWords = [...filledSlots];
  for (const slot of slots) {
    const wordIndex = remainingWords.findIndex(
      (w) => w.answer.length === slot.length
    );
    if (wordIndex === -1)
      throw new Error(
        `Could not find a matching word for a slot of length ${slot.length}.`
      );

    const word = remainingWords.splice(wordIndex, 1)[0];
    assignedSlots.push({ ...slot, ...word });
  }

  // Now, validate intersections and build the grid
  for (const word of assignedSlots) {
    let { row, col } = word.start;
    for (const char of word.answer.toUpperCase()) {
      if (tempGrid[row][col] && tempGrid[row][col] !== char) {
        throw new Error(
          `Intersection conflict at [${row},${col}] for word "${word.answer}".`
        );
      }
      tempGrid[row][col] = char;
      if (word.orientation === "ACROSS") col++;
      else row++;
    }
  }

  // Final assignment with the correct property name
  words = assignedSlots.map((w) => ({
    id: w.id,
    clue: w.clue,
    answer: w.answer,
    orientation: w.orientation,
    startPosition: w.start, // <-- The critical fix is here
    length: w.length,
  }));

  const solutionGrid = tempGrid.map((row, rIdx) =>
    row.map((cell, cIdx) => (template[rIdx][cIdx] === "0" ? null : cell))
  );

  console.log("Local assembly and validation successful!");
  return {
    gridSize,
    title: `Indian Mini Crossword - ${date}`,
    words,
    solutionGrid,
  };
}

// --- "CHAIN-OF-THOUGHT" GENERATION LOGIC ---
async function generateCrosswordWithOpenAI(slots, yesterdaysWords = []) {
  const apiKey = process.env.OPENAI_API_KEY_SECRET;
  if (!apiKey) throw new Error("CRITICAL: OPENAI_API_KEY_SECRET is not set.");
  const openai = new OpenAI({ apiKey });
  const filledSlots = [];
  const usedWords = new Set(yesterdaysWords);

  // Create a copy to not mutate the original
  const sortedSlots = [...slots].sort((a, b) => b.length - a.length);

  for (const slot of sortedSlots) {
    const { length, orientation } = slot;
    const uniquenessConstraint = `Do NOT use any of these words: ${[
      ...usedWords,
    ].join(", ")}.`;
    const prompt = `You are a crossword puzzle word filler. Find a single, India-themed English word and a clever, short clue for a slot of length ${length}. ${uniquenessConstraint} Your response MUST be a single, valid JSON object with the format: {"answer": "THEWORD", "clue": "Your clever clue here."}`;

    console.log(`Requesting word for slot: ${length}-${orientation}`);
    await sleep(API_DELAY_MS);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) throw new Error("OpenAI returned an empty response.");

    const { answer, clue } = JSON.parse(responseText);
    const upperAnswer = answer.toUpperCase();

    if (upperAnswer.length !== length)
      throw new Error(`AI word "${upperAnswer}" has wrong length.`);
    if (usedWords.has(upperAnswer))
      throw new Error(`AI reused word "${upperAnswer}".`);

    usedWords.add(upperAnswer);
    filledSlots.push({
      answer: upperAnswer,
      clue,
      orientation,
      start: slot.start,
      length,
    });
  }

  return filledSlots;
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
    console.error(`Could not find a suitable template.`);
  }

  let yesterdaysWords = [];
  try {
    const yesterday = new Date(istDate);
    yesterday.setDate(istDate.getDate() - 1);
    const yesterdayFilename = `${yesterday.getFullYear()}-${String(
      yesterday.getMonth() + 1
    ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}.json`;
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
        const filledSlots = await generateCrosswordWithOpenAI(
          slots,
          yesterdaysWords
        );
        finalPuzzleData = buildAndValidatePuzzle(
          chosenTemplate,
          filledSlots,
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
