// Final version with user's definitive intersection validation logic.
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { templates } from "./templates/grid-templates.js";

// --- CONFIGURATION ---
const OPENAI_MODEL_NAME = "gpt-4o";
const SAMPLE_PUZZLE_FILENAME = "2024-07-28.json";
const MAX_MAIN_RETRIES = 3;
const MAX_WORD_RETRIES = 3;
const MINIMUM_WORDS = 8;
const API_DELAY_MS = 1000;

// --- HELPER FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- DICTIONARY & VALIDATION ---
let mainDictionary = new Set();
const customIndianWords = new Set([
  "JAIPUR",
  "KABADI",
  "DIWALI",
  "HOLI",
  "PANEER",
  "SAREE",
  "GURU",
  "YOGA",
  "SITAR",
  "BANYAN",
  "RAGA",
  "TAJ",
  "LADDU",
  "DAAL",
  "IDLI",
  "DELHI",
  "MUMBAI",
  "PUNE",
  "GOA",
  "VEDA",
  "ASANA",
  "CHAI",
  "LOTUS",
  "ROTI",
  "SAMOSA",
  "BHAJI",
  "BINDI",
  "KARMA",
  "TANDOOR",
  "MASALA",
]);

function loadDictionary() {
  try {
    const words_txt = fs.readFileSync(
      path.join(process.cwd(), "scripts", "words.txt"),
      "utf-8"
    );
    mainDictionary = new Set(
      words_txt.split("\n").map((w) => w.trim().toUpperCase())
    );
    console.log(`Dictionary loaded with ${mainDictionary.size} unique words.`);
  } catch (e) {
    console.warn(
      "Warning: Main dictionary 'scripts/words.txt' not found. Using custom list only."
    );
  }
}

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  const upperWord = word.toUpperCase();
  return mainDictionary.has(upperWord) || customIndianWords.has(upperWord);
}

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
      words.push({ ...filled, id: slotInfo.id, startPosition: filled.start });
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

// --- GENERATION LOGIC ---
async function generateCrosswordWithOpenAI(slots, yesterdaysWords = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error(
      "CRITICAL: OPENAI_API_KEY secret is not set in the GitHub repository."
    );

  const openai = new OpenAI({ apiKey });
  const filledSlots = [];
  const tempGrid = Array(6)
    .fill(null)
    .map(() => Array(6).fill(null));
  const sortedSlots = [...slots].sort((a, b) => b.length - a.length);
  const usedWords = new Set(yesterdaysWords);

  for (const slot of sortedSlots) {
    let wordIsValidAndFits = false;
    let wordAttempts = 0;
    const failedWordsForSlot = [];

    while (!wordIsValidAndFits && wordAttempts < MAX_WORD_RETRIES) {
      wordAttempts++;
      console.log(
        `  > Slot (${slot.length}, ${slot.orientation}), Attempt ${wordAttempts}/${MAX_WORD_RETRIES}`
      );

      let constraints = [];
      let currentWordPattern = "_".repeat(slot.length);
      for (let i = 0; i < slot.length; i++) {
        const r = slot.start.row + (slot.orientation === "DOWN" ? i : 0);
        const c = slot.start.col + (slot.orientation === "ACROSS" ? i : 0);
        if (tempGrid[r][c]) {
          constraints.push(
            `The letter at index ${i} must be '${tempGrid[r][c]}'.`
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
      const system_prompt =
        "You are an expert crossword puzzle word filler. You only respond with a single, valid JSON object and nothing else.";
      const user_prompt = `
          Your primary task is to find a single common English word that is EXACTLY ${slot.length} letters long and fits the pattern "${currentWordPattern}". This is the most important instruction.
          
          Also provide a clever, short clue for the word.
          The word should ideally be India-themed if a common one fits, but creating a valid word of the correct length is the top priority.
          ${uniquenessConstraint}
          
          Your response format must be: {"answer": "THEWORD", "clue": "Your clever clue here."}
        `;

      try {
        await sleep(API_DELAY_MS);
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL_NAME,
          messages: [
            { role: "system", content: system_prompt },
            { role: "user", content: user_prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent)
          throw new Error("OpenAI returned an empty response.");

        const { answer, clue } = JSON.parse(responseContent);
        const upperAnswer = answer.toUpperCase();

        // Your definitive intersection validation
        let matchesGrid = true;
        let r_check = slot.start.row;
        let c_check = slot.start.col;
        for (let i = 0; i < upperAnswer.length; i++) {
          const gridLetter = tempGrid[r_check][c_check];
          if (gridLetter && gridLetter !== upperAnswer[i]) {
            matchesGrid = false;
            break;
          }
          if (slot.orientation === "ACROSS") c_check++;
          else r_check++;
        }
        if (!matchesGrid) {
          failedWordsForSlot.push(upperAnswer);
          throw new Error(
            `Word "${upperAnswer}" does not match the intersecting grid letters.`
          );
        }

        if (upperAnswer.length !== slot.length)
          throw new Error(`Word "${upperAnswer}" has wrong length.`);
        if (usedWords.has(upperAnswer))
          throw new Error(`Word "${upperAnswer}" has been used.`);
        if (!isValidWord(upperAnswer)) {
          failedWordsForSlot.push(upperAnswer);
          throw new Error(`Word "${upperAnswer}" is not in the dictionary.`);
        }

        wordIsValidAndFits = true;
        usedWords.add(upperAnswer);
        let { row, col } = slot.start;
        for (const char of upperAnswer) {
          tempGrid[row][col] = char;
          if (slot.orientation === "ACROSS") col++;
          else row++;
        }
        filledSlots.push({ ...slot, answer: upperAnswer, clue });
      } catch (e) {
        console.warn(`    > Word attempt failed: ${e.message}`);
        if (wordAttempts >= MAX_WORD_RETRIES) {
          throw new Error(
            `Could not find a valid word for slot after ${MAX_WORD_RETRIES} tries.`
          );
        }
      }
    }
  }
  return filledSlots;
}

// --- MAIN SCRIPT ---
async function main() {
  loadDictionary();

  const now = new Date();
  const istDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const todayStr = `${istDate.getFullYear()}-${String(
    istDate.getMonth() + 1
  ).padStart(2, "0")}-${String(istDate.getDate()).padStart(2, "0")}`;
  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${todayStr}.json`);

  if (fs.existsSync(puzzlePath)) {
    console.log(`Puzzle for ${todayStr} already exists. Skipping.`);
    return;
  }

  const validTemplates = templates.filter(
    (t) => findSlots(t).length >= MINIMUM_WORDS
  );
  if (validTemplates.length === 0) {
    console.error(
      `No templates found with at least ${MINIMUM_WORDS} words. Check grid-templates.js`
    );
    process.exit(1);
  }
  const chosenTemplate =
    validTemplates[Math.floor(Math.random() * validTemplates.length)];
  const slots = findSlots(chosenTemplate);
  console.log(`Selected a template with ${slots.length} words.`);

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
      console.log(
        "Found yesterday's words to avoid:",
        yesterdaysWords.join(", ")
      );
    }
  } catch (e) {
    console.warn("Could not read yesterday's puzzle.", e.message);
  }

  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt++) {
    console.log(
      `--- Generating new puzzle - Main Attempt ${attempt}/${MAX_MAIN_RETRIES} ---`
    );
    try {
      const filledSlots = await generateCrosswordWithOpenAI(
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
          "All AI generation attempts failed. Resorting to fallback."
        );
        const samplePuzzlePath = path.join(
          process.cwd(),
          "public",
          "puzzles",
          SAMPLE_PUZZLE_FILENAME
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
