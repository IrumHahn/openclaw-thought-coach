#!/usr/bin/env node
// 릴리스용 .skill(zip) 생성: skill/thought-coach 폴더만 담는다. tests/docs/.git 제외.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'thought-coach.skill');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
execFileSync('zip', ['-rq', out, 'thought-coach', '-x', '*.DS_Store'], { cwd: path.join(root, 'skill'), stdio: 'inherit' });
console.log(`packed ${out} (${fs.statSync(out).size} bytes)`);
