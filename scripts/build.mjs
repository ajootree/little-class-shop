import { build } from 'esbuild';
await build({entryPoints:['src/app.mjs'],bundle:true,outfile:'dist/app.js',format:'esm',target:'es2022',minify:true,sourcemap:false,legalComments:'eof'});
console.log('수업상점 정적 빌드 완료 → dist/');
