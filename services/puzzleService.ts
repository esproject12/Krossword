// Krossword-main/services/puzzleService.ts

import type { CrosswordData } from "../types";

// This function is for the client-side app to fetch pre-generated puzzles.
export const fetchPreGeneratedCrossword = async (
  dateString: string
): Promise<CrosswordData> => {
  const puzzleUrl = `/puzzles/${dateString}.json`;
  try {
    const response = await fetch(puzzleUrl);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Today's puzzle (${dateString}.json) not found.`
        );
      }
      throw new Error(
        `Failed to fetch puzzle from ${puzzleUrl}. Status: ${response.status}`
      );
    }
    const data = (await response.json()) as CrosswordData;
    if (data && data.gridSize && data.words && data.solutionGrid) {
      data.words.forEach((word) => (word.answer = word.answer.toUpperCase()));
      data.solutionGrid.forEach((row) => {
        if (row) {
          row.forEach((cell, i) => {
            if (typeof cell === "string") row[i] = cell.toUpperCase();
          });
        }
      });
      return data;
    } else {
      throw new Error(
        "Invalid puzzle data structure received from static file."
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
};