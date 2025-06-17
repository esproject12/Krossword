
export interface CellPosition {
  row: number;
  col: number;
}

export type Orientation = 'ACROSS' | 'DOWN';

export interface WordDefinition {
  id: number;
  clue: string;
  answer: string;
  orientation: Orientation;
  startPosition: CellPosition;
  length: number;
}

export interface CrosswordData {
  gridSize: number;
  title: string;
  words: WordDefinition[];
  solutionGrid: (string | null)[][];
}

// User's input grid: '' for empty, string for letter, null for black square
export type UserGrid = (string | null)[][];

// Cell state for styling, e.g. after checking answers
export type CellCheckState = 'unchecked' | 'correct' | 'incorrect';
export type CellCheckGrid = (CellCheckState | null)[][]; // null for black squares
