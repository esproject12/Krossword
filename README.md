Dodo Krossword 🦤

A modern, responsive, and daily mini crossword puzzle with a delightful Indian context. Built with React, TypeScript, and Vite, this app delivers a new 6x6 challenge every day.

➡️ Play the Live Demo Here!

✨ Key Features

Daily Puzzles: A new, unique crossword puzzle is generated automatically every day with a fresh, random "mini-theme."

Indian Theme: Clues and answers are inspired by a rich palette of 18+ topics, including Indian culture, history, cuisine, and general knowledge.

Fully Responsive & Adaptive Design:

A spacious two-column layout for desktop users.

A highly optimized, single-column "app-like" layout for mobile devices that intelligently adapts to both short and tall screens.

Professional Mobile UI/UX:

Viewport-Locked Layout: A robust, non-scrolling interface on mobile that uses modern CSS (dvh and CSS Grid) to eliminate frustrating layout shifts and guarantee a perfect fit on all devices, including iOS Safari and Android Chrome.

Custom On-Screen Keyboard: A comfortable, thumb-friendly keyboard that responsively adapts its size for a better ergonomic experience on taller phones.

"Flippable" Hint Panel: Game actions are neatly tucked away under a "💡" button on the keyboard, maximizing grid visibility.

Focused Clue Bar: Displays only the active clue, reducing cognitive load on smaller screens.

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

A Node.js script (scripts/generate.js) is designed to be run once per day via an automated scheduler (like a GitHub Action).

Intelligent Theming: Each day, the script randomly selects four unique themes (e.g., "Indian Cuisine," "Bollywood," "Mythology," "Sports") from a master list of 18+ topics to create a unique "mini-theme" for the puzzle.

Advanced AI Collaboration: The script uses an intelligent backtracking algorithm, guided by the OpenAI API (GPT-4o). For each empty slot in the crossword, it asks the AI for a list of 5 candidate words that fit the letter pattern and one of the day's themes.

Robust Validation: The script then iterates through the AI's suggestions, picking the first word that passes a series of rigorous checks: it must be in the custom dictionary, not be a repeat, and fit the interlocking letters perfectly. This "AI proposes, script disposes" model makes the generation process highly reliable.

The final puzzle is saved as a static JSON file (e.g., public/puzzles/2025-08-03.json).

Dictionary & Validation:
Every answer is checked against a custom, curated dictionary of over 41,000 words to ensure quality and relevance. This includes:

english_words.txt: A base vocabulary of common English words.

indian_words.txt: A specialized, hand-curated list of India-specific terms, names, and places to enrich the theme.

2. Frontend Application (Static Site)

The user-facing application is a pure static site built with React and Vite.

When you open the app, it simply fetches the pre-generated JSON file for the current date.

The app never calls the OpenAI API directly during gameplay. This ensures a fast user experience, zero API costs for users, and enhanced security.

Robust Cross-Browser Layout: The frontend uses modern CSS, including Dynamic Viewport Height (dvh) and CSS Grid, to create a stable, full-viewport layout that works consistently across all browsers and devices.

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

The application will be available at http://localhost:5173.

2. (Optional) Running the Puzzle Generation Script

If you want to generate your own puzzles, you'll need an OpenAI API key.

Create an environment file: Create a new file named .env in the root of the project.

Add your API key: Add your OpenAI API key to the .env file. The dotenv package is used to load this key.

Generated env
OPENAI_API_KEY="sk-YourSecretApiKeyHere"
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Env
IGNORE_WHEN_COPYING_END

Run the generation script: Execute the script using tsx. This will generate a new puzzle for the current date and save it in the public/puzzles/ directory.

Generated bash
npx tsx scripts/generate.js
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
Deployment

This project is configured for easy deployment on platforms like Netlify.

Build Command: npm run build

Publish Directory: dist

The Netlify deployment for the live demo is automatically triggered on every push to the main branch.

🔮 Future Enhancements

Puzzle Archive: A calendar view to access and play puzzles from previous dates.

User Statistics: Track solving times, streaks, and other personal stats.

PWA Support: Make the app installable on mobile devices for a true native-app experience.

Enhanced Accessibility: Further improvements to ARIA attributes and screen reader support.