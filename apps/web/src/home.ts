// APK assinado servido pelo mesmo domínio público do site.
const APK_DOWNLOAD_URL: string | null = "/downloads/fit.apk";

const downloadStatus = document.querySelector<HTMLParagraphElement>("#download-status");
for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-apk-download]")) {
  if (APK_DOWNLOAD_URL) {
    link.href = APK_DOWNLOAD_URL;
    link.setAttribute("download", "fit.apk");
    if (downloadStatus) downloadStatus.textContent = "Disponível para Android. Não é necessário entrar no site para baixar.";
  } else {
    link.addEventListener("click", () => {
      if (downloadStatus) downloadStatus.textContent = "O APK estará disponível em breve. Volte aqui para baixar o Fit para Android.";
    });
  }
}

export {};
