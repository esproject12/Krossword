Dodo Krossword 🦤

A modern, responsive, and daily mini crossword puzzle with a delightful Indian context. Built with React, TypeScript, and Vite, this app delivers a new 6x6 challenge every day.

➡️ Play the Live Demo Here!

✨ Key Features

Daily Puzzles: A new, unique crossword puzzle is generated automatically every day.

Indian Theme: Clues and answers are inspired by Indian culture, history, cuisine, and general knowledge.

Fully Responsive & Adaptive Design:

A spacious two-column layout for desktop users.

A highly optimized, single-column "app-like" layout for mobile devices that intelligently adapts to both short and tall screens.

Professional Mobile UI/UX:

Viewport-Locked Layout: A robust, non-scrolling interface on mobile that uses modern CSS (dvh and CSS Grid) to eliminate frustrating layout shifts and guarantee a perfect fit on all devices, including iOS Safari and Android Chrome.

Custom On-Screen Keyboard: A comfortable, thumb-friendly keyboard that responsively adapts its size for a better ergonomic experience on taller phones.

"Flippable" Hint Panel: Game actions are neatly tucked away under a "💡" button on the keyboard, maximizing grid visibility.

Focused Clue Bar: Displays only the active clue, reducing cognitive load on smaller screens.

Smart Keyboard Navigation:

Arrow keys for intuitive movement on desktop.

Automatic cursor advancement after typing a letter.

Game Tools:

Timer: Tracks your solving time.

Check Puzzle: Validates your answers and marks them as correct or incorrect.

Reveal Word/Puzzle: For when you need a little help.

Clear Puzzle: Easily reset the grid to start over.

Performance Optimized:

Client-side caching in localStorage for instant loads on subsequent visits.

A robust fallback to a sample puzzle if the daily puzzle fails to load.

🏗️ How It Works: A Two-Part System

The application is designed with a highly performant and cost-effective static-first architecture.

1. Backend Generation (Daily Job)

A Node.js script (scripts/generate.js) is designed to be run once per day via an automated scheduler (like a GitHub Action or a cron job).

This script uses template-based generation and an intelligent backtracking algorithm, guided by the OpenAI API (GPT-4o), to create a valid, high-quality 6x6 crossword puzzle.

The script handles complex logic like word validation, retries, and ensuring all words are fully interlocking.

The final puzzle is saved as a static JSON file (e.g., public/puzzles/2025-08-03.json).

Dictionary & Validation:
A key part of the generation process is word validation. Every answer suggested by the AI is checked against a custom, curated dictionary to ensure quality and relevance. This dictionary consists of:

english_words.txt: A base vocabulary of approximately 40,000 common English words.

indian_words.txt: A specialized list of over 2,300 words, including India-specific terms, names, and places to enrich the theme.

2. Frontend Application (Static Site)

The user-facing application is a pure static site built with React and Vite.

When you open the app, it simply fetches the pre-generated JSON file for the current date.

The app never calls the OpenAI API directly during gameplay. This ensures a fast user experience, zero API costs for users, and enhanced security.

Robust Cross-Browser Layout: The frontend uses modern CSS, including Dynamic Viewport Height (dvh) and CSS Grid, to create a stable, full-viewport layout that works consistently across all browsers and devices, eliminating the common layout issues found on mobile Safari.

🛠️ Tech Stack

Frontend: React, TypeScript, Vite, Tailwind CSS

Puzzle Generation: Node.js, OpenAI API (GPT-4o), dotenv

Deployment: Netlify

🚀 Getting Started

Follow these instructions to run the application on your local machine.

Prerequisites

Node.js (version 18.x or later)

npm or yarn

1. Running the Client App

This is all you need to do to play the game locally.

Clone the repository:

Generated bash
git clone https://github.com/your-username/dodo-krossword.git
cd dodo-krossword


Install dependencies:

Generated bash
npm install
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

Run the development server:

Generated bash
npm run dev
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END

The application will be available at http://localhost:5173. It will try to fetch today's puzzle and fall back to a sample if it's not found.

2. (Optional) Running the Puzzle Generation Script

If you want to generate your own puzzles, you'll need an OpenAI API key.

Create an environment file:
Create a new file named .env in the root of the project.

Add your API key:
Add your OpenAI API key to the .env file. The dotenv package is used to load this key into the script.

Generated env
OPENAI_API_KEY="sk-YourSecretApiKeyHere"
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Env
IGNORE_WHEN_COPYING_END

Run the generation script:
Execute the script using tsx. This will generate a new puzzle for the current date and save it in the public/puzzles/ directory.

Generated bash
npx tsx scripts/generate.js
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
Deployment

This project is configured for easy deployment on platforms like Netlify, Vercel, or GitHub Pages.

Build Command: npm run build

Publish Directory: dist

The Netlify deployment for the live demo is automatically triggered on every push to the main branch.

🔮 Future Enhancements

Puzzle Archive: A calendar view to access and play puzzles from previous dates.

User Statistics: Track solving times, streaks, and other personal stats.

PWA Support: Make the app installable on mobile devices for a true native-app experience.

Enhanced Accessibility: Further improvements to ARIA attributes and screen reader support.