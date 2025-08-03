// Add these two lines to the VERY TOP of generate.js
import dotenv from 'dotenv';
dotenv.config();

// Definitive version with all smart enhancements, including failed-state caching.
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

// --- NEW: MASTER THEME LIST ---
const MASTER_THEME_LIST = [
  "Indian Cuisine & Spices",
  "Bollywood & Indian Cinema",
  "Famous Indian Celebrities",
  "Indian Music & Dance",
  "Festivals of India",
  "Traditional Indian Attire & Crafts",
  "Hindu Mythology & Epics",
  "Indian History & Freedom Struggle",
  "Travel & Famous Landmarks of India",
  "Flora & Fauna of India",
  "Indian Fruits & Vegetables",
  "Rivers, Mountains & Natural Wonders",
  "Sports in India",
  "Indian Startups & Technology",
  "Common Hindi & Regional Words",
  "Means of Transport in India",
  "Indian Inventions & Mathematics",
  "Traditional Indian Games",
];

// In scripts/generate.js, right after the MASTER_THEME_LIST

function selectRandomThemes(themes, count = 4) {
  const shuffled = [...themes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// --- HELPER FUNCTION ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- DICTIONARY SETUP ---
let mainDictionary = new Set();
function loadDictionary() {
  console.log("Loading dictionaries...");
  const dictPaths = [
    path.join(process.cwd(), "scripts", "data", "english_words.txt"),
    path.join(process.cwd(), "scripts", "data", "indian_words.txt"),
  ];
  for (const dictPath of dictPaths) {
    try {
      if (fs.existsSync(dictPath)) {
        const txt = fs.readFileSync(dictPath, "utf-8");
        txt.split("\n").forEach((w) => {
          const word = w.trim().toUpperCase();
          if (word.length > 1) mainDictionary.add(word);
        });
      } else {
        console.warn(
          `Warning: Dictionary file not found: ${dictPath}. This may affect validation.`
        );
      }
    } catch (e) {
      console.error(`Error loading dictionary at ${dictPath}`, e);
    }
  }
  if (mainDictionary.size > 0) {
    console.log(`Dictionary loaded with ${mainDictionary.size} unique words.`);
  } else {
    console.error(
      "CRITICAL: No dictionary words were loaded. Validation will fail."
    );
  }
}

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  const upperWord = word.toUpperCase();
  const valid = mainDictionary.has(upperWord);
  if (valid) {
    console.log(`    > Validation for "${word}": PASSED (in dictionary)`);
  } else {
    console.log(`    > Validation for "${word}": FAILED (not in dictionary)`);
  }
  return valid;
}

// --- TEMPLATE LOGIC ---
// ... (This section is unchanged, so it's collapsed for brevity)
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
      const isAcrossStart =
        (c === 0 || template[r][c - 1] === "0") &&
        c + 1 < size &&
        template[r][c + 1] === "1";
      const isDownStart =
        (r === 0 || template[r - 1][c] === "0") &&
        r + 1 < size &&
        template[r + 1][c] === "1";
      if (isAcrossStart || isDownStart) {
        if (
          findWordLength(template, r, c, "ACROSS") > 2 ||
          findWordLength(template, r, c, "DOWN") > 2
        ) {
          numberGrid[r][c] = id++;
        }
      }
    }
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (template[r][c] === "0" || numberGrid[r][c] === 0) continue;
      const isAcrossStart = c === 0 || template[r][c - 1] === "0";
      const isDownStart = r === 0 || template[r - 1][c] === "0";
      if (isAcrossStart) {
        let length = findWordLength(template, r, c, "ACROSS");
        if (length > 2)
          slots.push({
            id: numberGrid[r][c],
            orientation: "ACROSS",
            start: { row: r, col: c },
            length,
          });
      }
      if (isDownStart) {
        let length = findWordLength(template, r, c, "DOWN");
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
function findWordLength(template, r, c, orientation) {
  let length = 0;
  const size = template.length;
  if (orientation === "ACROSS") {
    while (c + length < size && template[r][c + length] === "1") length++;
  } else {
    while (r + length < size && template[r + length][c] === "1") length++;
  }
  return length;
}
function buildPuzzle(template, filledSlots, date) {
  const gridSize = template.length;
  const solutionGrid = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(null));
  let words = [];
  const slotMap = new Map();
  findSlots(template).forEach((slot) => {
    slotMap.set(`${slot.orientation}-${slot.start.row}-${slot.start.col}`, {
      id: slot.id,
    });
  });
  for (const filled of filledSlots) {
    const slotInfo = slotMap.get(
      `${filled.orientation}-${filled.start.row}-${filled.start.col}`
    );
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
function printGrid(grid) {
  console.log("--- Current Grid State ---");
  console.log(
    grid.map((row) => row.map((cell) => cell || "_").join(" ")).join("\n")
  );
  console.log("--------------------------");
}

// PASTE THIS ENTIRE FUNCTION TO REPLACE YOUR OLD ONE

async function generateCrosswordWithBacktracking(slots, yesterdaysWords = [], themes) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("CRITICAL: OPENAI_API_KEY secret is not set.");
  const openai = new OpenAI({ apiKey });
  const sortedSlots = [...slots].sort((a, b) => b.length - a.length);
  const failedGridCache = new Set();
  const wordDetails = {}; // Store details of placed words

  async function solve(slotIndex, currentGrid, usedWords) {
    if (slotIndex >= sortedSlots.length) {
      console.log("🎉 Puzzle solved successfully!");
      return [];
    }

    const gridKey = currentGrid.flat().join("");
    if (failedGridCache.has(gridKey)) {
      return null;
    }

    const slot = sortedSlots[slotIndex];
    let currentWordPattern = "";
    let constraints = [];

    // --- NEW: EXPLAIN THE INTERSECTING WORDS ---
    for (let i = 0; i < slot.length; i++) {
      const r = slot.start.row + (slot.orientation === "DOWN" ? i : 0);
      const c = slot.start.col + (slot.orientation === "ACROSS" ? i : 0);
      const char = currentGrid[r][c];
      currentWordPattern += char || "_";
      if (char) {
        const intersectingSlotKey = `${slot.orientation === 'ACROSS' ? 'DOWN' : 'ACROSS'}-${r}-${c}`;
        const intersectingWordDetail = wordDetails[intersectingSlotKey];
        if (intersectingWordDetail) {
           constraints.push(`The letter at index ${i} must be '${char}' to intersect with the word "${intersectingWordDetail.answer}" (clue: "${intersectingWordDetail.clue}").`);
        } else {
           constraints.push(`The letter at index ${i} must be '${char}'.`);
        }
      }
    }
    
    console.log(`> Attempting to fill slot #${slotIndex} (${slot.orientation}, len=${slot.length}, pattern=${currentWordPattern})`);

    const system_prompt = "You are a crossword puzzle word generator. You only respond with a single, valid JSON object and nothing else.";
    
    // --- FINAL, CORRECTED "ESCAPE HATCH" PROMPT ---
    const user_prompt = `Your primary goal is to find a list of 5 common English words that are EXACTLY ${slot.length} letters long and perfectly match the pattern "${currentWordPattern}". ${constraints.join(" ")}

Your secondary, but very important, goal is to make these words fit one of today's themes: [${themes.join(", ")}].

Prioritize finding words that fit the letter pattern above all else. For each word in your list, try to find a themed word. If you cannot find a themed word that fits the pattern, provide a common, non-themed English word that fits instead. This is better than failing. Provide a clever, short clue for each suggested word.

Do NOT use any of these words: ${[...usedWords, ...yesterdaysWords].join(", ")}.

Your response must be in this exact JSON format: { "answers": [ {"answer": "WORD1", "clue": "Clue1"}, {"answer": "WORD2", "clue": "Clue2"} ] }`;
    
    try {
      await sleep(API_DELAY_MS);
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL_NAME,
        messages: [
          { role: "system", content: system_prompt },
          { role: "user", content: user_prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) throw new Error("OpenAI returned an empty response.");
      
      const { answers } = JSON.parse(responseContent);
      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        throw new Error("AI response was not a valid list of answers.");
      }

      for (const candidate of answers) {
        const { answer, clue } = candidate;
        if (!answer || !clue) continue;

        const upperAnswer = answer.toUpperCase();

        if (upperAnswer.length !== slot.length || usedWords.has(upperAnswer) || !isValidWord(upperAnswer)) continue;
        
        let patternMismatch = false;
        for (let i = 0; i < upperAnswer.length; i++) {
          if (currentWordPattern[i] !== "_" && currentWordPattern[i] !== upperAnswer[i]) {
            patternMismatch = true;
            break;
          }
        }
        if (patternMismatch) continue;

        let newGrid = currentGrid.map((r) => [...r]);
        let r_check = slot.start.row, c_check = slot.start.col;
        for (const char of upperAnswer) {
          newGrid[r_check][c_check] = char;
          if (slot.orientation === "ACROSS") c_check++; else r_check++;
        }
        
        console.log(`  + Trying candidate "${upperAnswer}" for slot #${slotIndex}.`);
        
        // Store the word detail for better context in subsequent calls
        const slotKey = `${slot.orientation}-${slot.start.row}-${slot.start.col}`;
        wordDetails[slotKey] = { answer: upperAnswer, clue };

        const result = await solve(slotIndex + 1, newGrid, new Set(usedWords).add(upperAnswer));

        if (result !== null) {
          return [{ ...slot, answer: upperAnswer, clue }, ...result];
        }
        // If the path failed, remove the word detail before trying the next candidate
        delete wordDetails[slotKey];
      }
      
      console.log(` < FAILED: None of the AI's candidates for slot #${slotIndex} led to a solution. Backtracking...`);
      failedGridCache.add(gridKey);
      return null;

    } catch (e) {
      console.warn(`    > API call or parsing failed for slot #${slotIndex}: ${e.message}. Backtracking...`);
      failedGridCache.add(gridKey);
      return null;
    }
  }

  const initialGrid = Array(6).fill(null).map(() => Array(6).fill(null));
  const solution = await solve(0, initialGrid, new Set(yesterdaysWords));
  if (!solution) throw new Error("Could not find a valid interlocking puzzle solution after all attempts.");
  return solution;
}

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
    console.error(`No templates found with at least ${MINIMUM_WORDS} words.`);
    process.exit(1);
  }
  const chosenTemplate =
    validTemplates[Math.floor(Math.random() * validTemplates.length)];
  const slots = findSlots(chosenTemplate);

  // --- NEW: RANDOMLY SELECT 4 THEMES FOR TODAY ---
  const dailyThemes = selectRandomThemes(MASTER_THEME_LIST, 4);
  console.log("--- Today's Mini-Theme ---");
  dailyThemes.forEach(theme => console.log(`- ${theme}`));
  console.log("--------------------------");

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
      const filledSlots = await generateCrosswordWithBacktracking(
        slots,
        yesterdaysWords,
        dailyThemes // <-- Pass the array of 4 themes
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
