import { loadEnv } from './env.js';

loadEnv();
const { default: app } = await import('./app.js');

console.log('DB_HOST', Boolean(process.env.DB_HOST));
console.log('DB_USER', Boolean(process.env.DB_USER));
console.log('DB_PASSWORD set:', typeof process.env.DB_PASSWORD === 'string' && process.env.DB_PASSWORD.length > 0);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
