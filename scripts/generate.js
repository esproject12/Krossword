// Final version with a "primed" prompt for better AI performance.
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_RETRIES = 3;
const MINIMUM_WORDS = 8;
const API_DELAY_MS = 1000;

// --- HELPER FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  for (const filled of filledSlots) {
    const key = `${filled.orientation}-${filled.start.row}-${filled.start.col}`;
    const slotInfo = slotMap.get(key);
    if (slotInfo) {
      if (filled.answer.length !== filled.length) {
        throw new Error(`AI word "${filled.answer}" length mismatch.`);
      }
      words.push({ ...filled, id: slotInfo.id });
      const { answer, start, orientation } = filled;
      let { row, col } = start;
      for (const char of answer) {
        if (row < gridSize && col < gridSize) {
          if (solutionGrid[row][col] && solutionGrid[row][col] !== char) {
            throw new Error(
              `Intersection conflict at [${row},${col}] for word "${answer}".`
            );
          }
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

async function generateCrosswordWithOpenAI(slots, yesterdaysWords = []) {
  const apiKey = process.env.OPENAI_API_KEY_SECRET;
  if (!apiKey) throw new Error("CRITICAL: OPENAI_API_KEY_SECRET is not set.");

  const openai = new OpenAI({ apiKey });
  const filledSlots = [];
  const tempGrid = Array(6)
    .fill(null)
    .map(() => Array(6).fill(null));
  const sortedSlots = [...slots].sort((a, b) => b.length - a.length);
  const usedWords = new Set(yesterdaysWords);

  for (const slot of sortedSlots) {
    const { length, orientation, start } = slot;
    let constraints = [];
    let currentWordPattern = "_".repeat(length);
    const uniquenessConstraint = `Do NOT use any of these words: ${[
      ...usedWords,
    ].join(", ")}.`;

    for (let i = 0; i < length; i++) {
      const r = start.row + (orientation === "DOWN" ? i : 0);
      const c = start.col + (orientation === "ACROSS" ? i : 0);
      if (tempGrid[r][c]) {
        constraints.push(
          `The letter at index ${i} (0-indexed) must be '${tempGrid[r][c]}'.`
        );
        let pattern = currentWordPattern.split("");
        pattern[i] = tempGrid[r][c];
        currentWordPattern = pattern.join("");
      }
    }

    const prompt = `
      You are an expert crossword puzzle word filler.
      Task: Find a single, India-themed English word and a clever, short clue for it.
      
      Word to find: A ${length}-letter word matching the pattern "${currentWordPattern}".
      Constraints: ${constraints.length > 0 ? constraints.join(" ") : "None."}
      ${uniquenessConstraint}
      
      Your response MUST be a single, valid JSON object with the format: {"answer": "THEWORD", "clue": "Your clever clue here.", "length": ${length}}
      The "length" property in your JSON response MUST be exactly ${length}.
      Do NOT include markdown fences, explanations, or any other text.
    `;

    console.log(
      `Requesting word for slot: ${length}-${orientation} at [${start.row},${start.col}]`
    );
    await sleep(API_DELAY_MS);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) throw new Error("OpenAI returned an empty response.");

    const { answer, clue, length: returnedLength } = JSON.parse(responseText);

    const upperAnswer = answer.toUpperCase();
    if (upperAnswer.length !== length || returnedLength !== length) {
      throw new Error(
        `AI returned word "${upperAnswer}" with length ${upperAnswer.length}, but slot requires ${length}.`
      );
    }
    if (usedWords.has(upperAnswer)) {
      throw new Error(
        `AI returned a word that has already been used: ${upperAnswer}`
      );
    }

    usedWords.add(upperAnswer);
    let { row, col } = start;
    for (const char of upperAnswer) {
      tempGrid[row][col] = char;
      if (orientation === "ACROSS") col++;
      else row++;
    }
    filledSlots.push({ answer: upperAnswer, clue, orientation, start, length });
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
        const filledSlots = await generateCrosswordWithOpenAI(
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
