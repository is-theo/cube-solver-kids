declare module 'cubejs' {
  export default class Cube {
    static initSolver(): void;
    static fromString(s: string): Cube;
    static random(): Cube;
    static inverse(moves: string): string;
    asString(): string;
    isSolved(): boolean;
    move(moves: string): Cube;
    solve(maxDepth?: number): string;
    clone(): Cube;
  }
}
