
// Ensure this file is treated as a module
export {};

declare global {
  // Use var to allow redeclaration/merging in the global scope, fixing block-scoped declaration errors.
  var process: {
    env: {
      readonly API_KEY: string;
      [key: string]: string | undefined;
    };
  };
}
