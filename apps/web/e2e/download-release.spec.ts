import {test,expect} from '@playwright/test';
test('download mostra versão publicada e nome de APK com SemVer',async({page})=>{
 await page.route('**/downloads/release.json',route=>route.fulfill({json:{version:'1.0.2',displayVersion:'1.02',versionCode:5,bytes:107000000,downloadUrl:'http://127.0.0.1:3341/downloads/orami-1.0.2-android.apk'}}));
 await page.goto('/');
 const link=page.locator('[data-apk-download]').first();
 await expect(link).toHaveAttribute('download','orami-1.0.2-android.apk');
 await expect(link).toContainText('Versão 1.02');
 await expect(link).toHaveAttribute('href','/downloads/orami-1.0.2-android.apk');
 await expect(page.locator('#download-status')).toContainText('Versão 1.02 disponível');
});
test('site não anuncia versão nem libera download se manifesto estiver indisponível',async({page})=>{
 await page.route('**/downloads/release.json',route=>route.fulfill({status:503,body:''}));
 await page.goto('/');
 await expect(page.locator('[data-apk-download]').first()).toHaveAttribute('aria-disabled','true');
 await expect(page.locator('#download-status')).toContainText('Não foi possível consultar');
});
