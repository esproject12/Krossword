// scripts/generate-puzzle.mjs
import { generateCrosswordWithGemini } from "../src/services/geminiService";
import fs from "fs";
import path from "path";

const getTodayDateString = () => {
  return new Date().toISOString().split("T")[0];
};

async function generateAndSave() {
  const today = getTodayDateString();
  const puzzleDir = path.join(process.cwd(), "public", "puzzles");
  const puzzlePath = path.join(puzzleDir, `${today}.json`);

  // Create the puzzles directory if it doesn't exist
  if (!fs.existsSync(puzzleDir)) {
    fs.mkdirSync(puzzleDir, { recursive: true });
  }

  // Check if a puzzle for today already exists
  if (fs.existsSync(puzzlePath)) {
    console.log(`Puzzle for ${today} already exists. Skipping generation.`);
    return;
  }

  console.log(`Generating new puzzle for ${today}...`);
  try {
    // We need to temporarily set the environment variable for the service to read it
    process.env.API_KEY = process.env.GEMINI_API_KEY_FROM_SECRET;

    if (!process.env.API_KEY) {
      throw new Error(
        "GEMINI_API_KEY_FROM_SECRET is not set in the environment."
      );
    }

    const crosswordData = await generateCrosswordWithGemini();
    fs.writeFileSync(puzzlePath, JSON.stringify(crosswordData, null, 2));
    console.log(`Successfully generated and saved puzzle to ${puzzlePath}`);
  } catch (error) {
    console.error("Failed to generate crossword puzzle:", error);
    // Exit with an error code to make the GitHub Action fail
    process.exit(1);
  }
}

generateAndSave();
