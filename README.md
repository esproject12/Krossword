# Dodo Krossword 🦤

A modern, responsive, and daily mini crossword puzzle with a delightful Indian context. Built with React, TypeScript, and Vite, this app delivers a new 6x6 challenge every day.

**[➡️ Play the Live Demo Here!](https://dodo-krossword.netlify.app/)**

---

## ✨ Key Features

- **Daily Puzzles**: A new, unique crossword puzzle is generated automatically every day.
- **Indian Theme**: Clues and answers are inspired by Indian culture, history, cuisine, and general knowledge.
- **Fully Responsive Design**:
  - A spacious two-column layout for desktop users.
  - A highly optimized, single-column "app-like" layout for mobile devices.
- **Professional Mobile UI/UX**:
  - **Viewport-Locked Layout:** A robust, non-scrolling interface on mobile that eliminates frustrating layout shifts, tested on both iOS Safari and Android Chrome.
  - **Custom On-Screen Keyboard:** A comfortable, thumb-friendly keyboard for a native app feel.
  - **"Flippable" Hint Panel:** Game actions are neatly tucked away under a "💡" button on the keyboard, maximizing grid visibility.
  - **Focused Clue Bar:** Displays only the active clue, reducing cognitive load on smaller screens.
- **Smart Keyboard Navigation**:
  - Arrow keys for intuitive movement on desktop.
  - Automatic cursor advancement after typing a letter.
  - Smart skipping over already-filled cells in intersecting words.
- **Game Tools**:
  - **Timer**: Tracks your solving time.
  - **Check Puzzle**: Validates your answers and marks them as correct or incorrect.
  - **Reveal Word/Puzzle**: For when you need a little help.
  - **Clear Puzzle**: Easily reset the grid to start over.
- **Performance Optimized**:
  - Client-side caching in `localStorage` for instant loads on subsequent visits.
  - A robust fallback to a sample puzzle if the daily puzzle fails to load.

---

## 🏗️ How It Works: A Two-Part System

The application is designed with a highly performant and cost-effective static-first architecture.

### 1. Backend Generation (Daily Job)

- A Node.js script (`scripts/generate.js`) is designed to be run once per day via an automated scheduler (like a GitHub Action or a cron job).
- This script uses **template-based generation** and an **intelligent backtracking algorithm**, guided by the **OpenAI API (GPT-4o)**, to create a valid, high-quality 6x6 crossword puzzle.
- The script handles complex logic like correct clue numbering and ensures all words are valid and interlocking.
- The final puzzle is saved as a static JSON file (e.g., `public/puzzles/2025-07-06.json`).

**Dictionary & Validation:**
A key part of the generation process is word validation. Every answer is checked against a custom, curated dictionary to ensure quality and relevance. This dictionary consists of:

- **`english_words.txt`**: A base vocabulary of approximately 40,000 common English words (up to 6 letters).
- **`indian_words.txt`**: A specialized list of over 2,300 words, including ~1,250 India-specific terms (up to 6 letters), names, and places to enrich the theme.
- **Asset for Future Expansion:** The repository also includes `english_words_full.txt`, a comprehensive dictionary containing over 400,000 English words of all lengths. This file is not used by the current 6x6 puzzle generator to keep the answers common and concise, but it is ready to be implemented for future features like larger grids (e.g., 7x7 or greater).

### 2. Frontend Application (Static Site)

- The user-facing application is a pure **static site** built with React and Vite.
- When you open the app, it simply fetches the pre-generated JSON file for the current date.
- **The app never calls the OpenAI API directly during gameplay.** This ensures a fast user experience, zero API costs for users, and enhanced security.
- **Robust Cross-Browser Layout:** The frontend uses a combination of modern CSS Grid and a custom React hook (`useWindowSize`) to create a stable, full-viewport layout that works consistently across browsers, including the notoriously tricky mobile Safari.

---

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Puzzle Generation**: Node.js, OpenAI API
- **Deployment**: Netlify

---

## 🚀 Getting Started

Follow these instructions to run the application on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### 1. Running the Client App

This is all you need to do to play the game locally.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/dodo-krossword.git
    cd dodo-krossword
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`. It will try to fetch today's puzzle and fall back to a sample if it's not found.

### 2. (Optional) Running the Puzzle Generation Script

If you want to generate your own puzzles, you'll need an OpenAI API key.

1.  **Create an environment file:**
    Create a new file named `.env` in the root of the project.

2.  **Add your API key:**
    Add your OpenAI API key to the `.env` file.

    ```env
    OPENAI_API_KEY="sk-YourSecretApiKeyHere"
    ```

3.  **Run the generation script:**
    Execute the script using `tsx`. This will generate a new puzzle for the current date and save it in the `public/puzzles/` directory.
    ```bash
    npx tsx scripts/generate.js
    ```

---

## Deployment

This project is configured for easy deployment on platforms like Netlify, Vercel, or GitHub Pages.

- **Build Command**: `npm run build`
- **Publish Directory**: `dist`

The Netlify deployment for the live demo is automatically triggered on every push to the `main` branch.

---

## 🔮 Future Enhancements

- **Puzzle Archive**: A calendar view to access and play puzzles from previous dates.
- **User Statistics**: Track solving times, streaks, and other personal stats.
- **PWA Support**: Make the app installable on mobile devices for an app-like experience.
- **Enhanced Accessibility**: Further improvements to ARIA attributes and screen reader support.
