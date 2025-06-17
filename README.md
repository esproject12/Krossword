# Indian Crossword Mini

A daily mini crossword puzzle with an Indian context, powered by Gemini. Enjoy a new challenge every day with words and clues related to Indian culture, history, sports, and more.

This project is a web application built with React, TypeScript, and Vite.

## How It Works

The application is designed to be low-maintenance for daily use:
1.  **Puzzle Generation (Backend Process):** A script (not included, but using `services/geminiService.ts`) is intended to be run daily via a scheduled task (e.g., a GitHub Action or cron job). This script calls the Gemini API to generate a new 5x5 crossword puzzle.
2.  **Static Puzzle Files:** The generated puzzle is saved as a static JSON file (e.g., `2024-07-29.json`) and placed in the `/public/puzzles/` directory.
3.  **Client Application:** The React application that users interact with is a purely static client. When a user opens the app, it fetches the pre-generated JSON puzzle for the current date. It does **not** call the Gemini API directly during normal gameplay.

This architecture ensures a fast user experience and minimizes API costs, as the Gemini API is only called once per day for generation.

## Running Locally

**Prerequisites:** Node.js and npm (or yarn/pnpm).

1.  **Clone the repository and install dependencies:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    npm install
    ```

2.  **Running the Client App:**
    To run the web app and play the crossword (fetching from `/public/puzzles`), simply start the Vite development server:
    ```bash
    npm run dev
    ```
    This will start the app on `http://localhost:5173`. It will try to fetch today's puzzle, and if it's not found, it will load the sample puzzle.

3.  **(Optional) Setting up for Puzzle Generation:**
    If you want to run the puzzle generation logic yourself, you will need a Gemini API key.

    *   Create a file named `.env` in the root of the project.
    *   Add your Gemini API key to this file:
        ```
        GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
        ```
    *   You can then create a script (e.g., `generate-puzzle.ts`) that imports and calls the `generateCrosswordWithGemini` function from `services/geminiService.ts` to generate a new puzzle JSON.