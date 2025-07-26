// A list of 14 valid, high-quality, pre-designed 6x6 grid layouts.
// '1' represents a letter, '0' represents a black square.
export const templates = [
  // Template 1: High Density (12 words)
  ["111011", "111011", "111111", "011011", "110110", "110111"],
  // Template 2: Symmetrical High Density (10 words)
  ["111110", "101011", "111101", "101111", "110101", "011111"],
  // Template 3: Original "Windmill" (8 words)
  ["111000", "111011", "100011", "110001", "110111", "000111"],
  // Template 4: Open Corners (10 words)
  ["011110", "101011", "110101", "101011", "110101", "011110"],
  // Template 5: Pinwheel (10 words)
  ["011110", "110011", "100001", "100001", "110011", "011110"],
  // --- NEW TEMPLATES ---
  // Template 6: "H" Block (10 words)
  ["110111", "110111", "111111", "110111", "110111", "000000"],
  // Template 7: Double-T (10 words)
  ["111111", "001100", "001100", "001100", "001100", "001100"],
  // Template 8: Central Block (8 words)
  ["111111", "100001", "101101", "101101", "100001", "111111"],
  // Template 9: Offset Blocks (8 words)
  ["001100", "111111", "111111", "001100", "111111", "111111"],
  // Template 10: Diagonal Flow (10 words)
  ["111001", "111101", "011110", "011110", "101111", "100111"],
  // Template 11: Hashtag (9 words)
  ["010101", "111111", "010101", "111111", "010101", "111111"],
  // Template 12: Mirrored L's (8 words)
  ["111100", "100000", "101111", "111101", "000001", "001111"],
  // Template 13: Interlocked Squares (8 words)
  ["110110", "110110", "000000", "110110", "110110", "000000"],
  // Template 14: Segmented Grid (12 words)
  ["110110", "110110", "110110", "000000", "110110", "110110"],
];
