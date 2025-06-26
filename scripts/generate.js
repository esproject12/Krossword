// Final version with "Inner Retry Loop" for AI self-validation.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_MAIN_RETRIES = 3;
const MAX_WORD_RETRIES = 3;
const MINIMUM_WORDS = 8;
const API_DELAY_MS = 2000; // A safe delay to avoid rate limiting

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
      words.push({ ...filled, id: slotInfo.id });
      const { answer, start, orientation } = filled;
      let { row, col } = start;
      for (const char of answer) {
        solutionGrid[row][col] = char;
        if (orientation === "ACROSS") col++;
        else row++;
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

// --- AI-POWERED VALIDATION FUNCTION ---
async function isWordValid(ai, word) {
  if (!word || word.length < 3) return false;
  console.log(`    > Validating word: "${word}"...`);
  await sleep(API_DELAY_MS);
  const prompt = `Is "${word}" a real, common, correctly-spelled English word? Please answer with only a single word: YES or NO.`;
  const result = await ai.models.generateContent(prompt);
  const responseText = result.response.text().trim().toUpperCase();
  console.log(`    > Validation response for "${word}": ${responseText}`);
  return responseText === "YES";
}

// --- "CHAIN-OF-THOUGHT" GENERATION LOGIC with INNER RETRY LOOP ---
async function generateCrosswordWithChainOfThought(
  slots,
  yesterdaysWords = []
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("CRITICAL: GEMINI_API_KEY is not set.");
  const ai = new GoogleGenAI({ apiKey });

  const filledSlots = [];
  const tempGrid = Array(6)
    .fill(null)
    .map(() => Array(6).fill(null));
  const sortedSlots = [...slots].sort((a, b) => b.length - a.length);
  const usedWords = new Set(yesterdaysWords);

  for (const slot of sortedSlots) {
    let wordIsValid = false;
    let wordAttempts = 0;
    const failedWordsForSlot = [];

    while (!wordIsValid && wordAttempts < MAX_WORD_RETRIES) {
      wordAttempts++;
      console.log(
        `  > Attempting to fill slot (${slot.length}, ${slot.orientation}) - Word Attempt ${wordAttempts}/${MAX_WORD_RETRIES}`
      );

      let constraints = [];
      let currentWordPattern = "_".repeat(slot.length);
      for (let i = 0; i < slot.length; i++) {
        const r = slot.start.row + (slot.orientation === "DOWN" ? i : 0);
        const c = slot.start.col + (slot.orientation === "ACROSS" ? i : 0);
        if (tempGrid[r][c]) {
          constraints.push(
            `The letter at index ${i} (0-indexed) must be '${tempGrid[r][c]}'.`
          );
          let p = currentWordPattern.split("");
          p[i] = tempGrid[r][c];
          currentWordPattern = p.join("");
        }
      }
      const uniquenessConstraint = `Do NOT use any of these words: ${[
        ...usedWords,
        ...failedWordsForSlot,
      ].join(", ")}.`;

      const user_prompt = `
          Find a single, India-themed English word and a clever, short clue for it.
          Word to find: A ${
            slot.length
          }-letter word matching the pattern "${currentWordPattern}".
          Constraints: ${
            constraints.length > 0 ? constraints.join(" ") : "None."
          }
          ${uniquenessConstraint}
          Your response MUST be a single, valid JSON object with the format: {"answer": "THEWORD", "clue": "Your clever clue here."}
        `;

      try {
        await sleep(API_DELAY_MS);
        const result = await ai.models.generateContent({
          model: GEMINI_MODEL_NAME,
          contents: [{ role: "user", parts: [{ text: user_prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        });
        const responseText = result.response.text();
        const { answer, clue } = JSON.parse(responseText);
        const upperAnswer = answer.toUpperCase();

        if (upperAnswer.length !== slot.length)
          throw new Error(`Word "${upperAnswer}" has incorrect length.`);
        if (usedWords.has(upperAnswer))
          throw new Error(`Word "${upperAnswer}" has been used.`);

        if (await isWordValid(ai, upperAnswer)) {
          wordIsValid = true;
          usedWords.add(upperAnswer);
          let { row, col } = slot.start;
          for (const char of upperAnswer) {
            tempGrid[row][col] = char;
            if (slot.orientation === "ACROSS") col++;
            else row++;
          }
          filledSlots.push({
            answer: upperAnswer,
            clue,
            orientation: slot.orientation,
            start: slot.start,
            length: slot.length,
          });
        } else {
          failedWordsForSlot.push(upperAnswer);
          throw new Error(`Word "${upperAnswer}" was deemed invalid.`);
        }
      } catch (e) {
        console.warn(`    > Word Attempt ${wordAttempts} failed: ${e.message}`);
        if (wordAttempts >= MAX_WORD_RETRIES) {
          throw new Error(
            `Could not find a valid word for slot (${slot.length}, ${slot.orientation}) after ${MAX_WORD_RETRIES} tries.`
          );
        }
      }
    }
  }
  return filledSlots;
}

async function main() {
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

  const validTemplates = templates.filter(
    (t) => findSlots(t).length >= MINIMUM_WORDS
  );
  if (validTemplates.length === 0)
    throw new Error(`No templates found with at least ${MINIMUM_WORDS} words.`);
  const chosenTemplate =
    validTemplates[Math.floor(Math.random() * validTemplates.length)];
  const slots = findSlots(chosenTemplate);

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
      yesterdaysWords = JSON.parse(
        fs.readFileSync(yesterdayPath, "utf-8")
      ).words.map((w) => w.answer);
    }
  } catch (e) {
    console.warn("Could not read yesterday's puzzle.", e.message);
  }

  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt++) {
    console.log(
      `--- Generating new puzzle - Main Attempt ${attempt}/${MAX_MAIN_RETRIES} ---`
    );
    try {
      const filledSlots = await generateCrosswordWithChainOfThought(
        slots,
        yesterdaysWords
      );
      const finalPuzzleData = buildPuzzle(
        chosenTemplate,
        filledSlots,
        todayStr
      );
      fs.writeFileSync(puzzlePath, JSON.stringify(finalPuzzleData, null, 2));
      console.log(
        `Successfully generated and saved new puzzle to ${puzzlePath}`
      );
      return;
    } catch (error) {
      console.error(`Main Attempt ${attempt} failed:`, error.message);
      if (attempt === MAX_MAIN_RETRIES) {
        console.error(
          "All main generation attempts failed. Resorting to fallback."
        );
        try {
          if (!fs.existsSync(samplePuzzlePath))
            throw new Error(`CRITICAL: Sample puzzle file not found.`);
          const sampleData = fs.readFileSync(samplePuzzlePath, "utf-8");
          const puzzleJson = JSON.parse(sampleData);
          puzzleJson.title = `Indian Mini Crossword - ${todayStr}`;
          fs.writeFileSync(puzzlePath, JSON.stringify(puzzleJson, null, 2));
          console.log(`Successfully used sample puzzle as fallback.`);
        } catch (fallbackError) {
          console.error("CRITICAL: Fallback failed.", fallbackError);
          process.exit(1);
        }
      }
    }
  }
}

main();
