import { useMemo } from "react";

interface VoxelAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

// Deterministic hash from string
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

// Generate a deterministic color palette from a seed
const generatePalette = (hash: number): string[] => {
  const hue = hash % 360;
  return [
    `hsl(${hue}, 70%, 55%)`,        // primary
    `hsl(${(hue + 30) % 360}, 65%, 45%)`,  // darker
    `hsl(${(hue + 60) % 360}, 60%, 65%)`,  // accent
    `hsl(${hue}, 50%, 75%)`,        // light
    `hsl(${(hue + 180) % 360}, 55%, 50%)`, // contrast
  ];
};

// 5x5 symmetric pixel pattern (only need left half + center column)
const generatePattern = (hash: number): boolean[][] => {
  const grid: boolean[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x++) {
      // Use different bits of hash for each cell
      const bit = (hash >> (y * 3 + x)) & 1;
      row.push(bit === 1);
    }
    // Mirror: col 0,1,2 → 2,1,0 becomes 0,1,2,1,0
    grid.push([row[0], row[1], row[2], row[1], row[0]]);
  }
  return grid;
};

export default function VoxelAvatar({ seed, size = 40, className = "" }: VoxelAvatarProps) {
  const { pattern, palette, bgColor } = useMemo(() => {
    const hash = hashCode(seed);
    const hash2 = hashCode(seed + "_extra");
    const palette = generatePalette(hash);
    const pattern = generatePattern(hash2);
    const bgColor = `hsl(${hash % 360}, 25%, 88%)`;
    return { pattern, palette, bgColor };
  }, [seed]);

  const cellSize = size / 7; // 5 cells + 1px padding each side
  const offset = cellSize; // padding

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-full ${className}`}
      style={{ background: bgColor }}
    >
      {pattern.map((row, y) =>
        row.map((filled, x) => {
          if (!filled) return null;
          const colorIdx = (x + y) % palette.length;
          return (
            <rect
              key={`${x}-${y}`}
              x={offset + x * cellSize}
              y={offset + y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={palette[colorIdx]}
              rx={cellSize * 0.15}
            />
          );
        })
      )}
    </svg>
  );
}
