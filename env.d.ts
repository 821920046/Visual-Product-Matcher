
// Augment the existing ProcessEnv interface to include API_KEY
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
      [key: string]: string | undefined;
    }
  }
}

export {};
