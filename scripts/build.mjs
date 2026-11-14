import { build } from 'esbuild';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({entryPoints:['src/app.mjs'],bundle:true,outfile:'dist/app.js',format:'esm',target:'es2022',minify:true,sourcemap:false,legalComments:'eof'});
let html=await fs.readFile('dist/index.html','utf8');
for(const asset of ['app.js','style.css']){
  const version=createHash('sha256').update(await fs.readFile('dist/'+asset)).digest('hex').slice(0,16);
  const pattern=new RegExp('\\./'+asset.replaceAll('.','\\.')+'(?:\\?v=[a-f0-9]+)?','g');
  if(!pattern.test(html))throw new Error('Missing asset reference: '+asset);
  html=html.replace(pattern,'./'+asset+'?v='+version);
}
await fs.writeFile('dist/index.html',html);
console.log('수업상점 정적 빌드 완료 → dist/');
