import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
test('papéis de acessibilidade literais do app são aceitos pelo Android instalado', async () => {
 const root=resolve(import.meta.dirname,'../../..');
 const native=await readFile(resolve(root,'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt'),'utf8');
 const enumBody=native.split('public enum class AccessibilityRole {')[1].split('public companion object')[0];
 const allowed=new Set([...enumBody.matchAll(/\b[A-Z][A-Z_]+\b/g)].map(m=>m[0].toLowerCase()));
 async function scan(directory:string):Promise<void>{for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())await scan(path);else if(path.endsWith('.tsx')){const source=await readFile(path,'utf8');for(const match of source.matchAll(/accessibilityRole=["']([^"']+)["']/g))assert.ok(allowed.has(match[1].toLowerCase()),`${path}: ${match[1]} é rejeitado pelo Android`);}}}
 await scan(resolve(root,'apps/mobile/src'));
});
