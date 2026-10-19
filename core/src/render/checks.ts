/** Renderer-independent structural checks; adapters can retain their public error class. */
export type Ensure = (condition: unknown, message: string) => asserts condition;
export const requireThat: Ensure = (condition, message) => { if (!condition) throw new Error(message); };
