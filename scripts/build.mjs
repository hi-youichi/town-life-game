import { mkdir, copyFile, cp } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await copyFile(new URL('../index.html', import.meta.url), new URL('../dist/index.html', import.meta.url));
await cp(new URL('../src/', import.meta.url), new URL('../dist/src/', import.meta.url), { recursive: true });
