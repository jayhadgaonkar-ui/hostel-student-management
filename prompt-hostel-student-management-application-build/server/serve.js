// Serves the production build on Vite's familiar localhost port.
process.env.PORT ||= '5173';
await import('./index.js');
