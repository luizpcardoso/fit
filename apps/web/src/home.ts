// The published APK manifest is authoritative; an independent web deploy cannot advertise an unpublished version.
const status = document.querySelector<HTMLParagraphElement>("#download-status");
const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-apk-download]")];
let ready = false;
for (const link of links) link.addEventListener("click", event => { if (!ready) event.preventDefault(); });
async function loadRelease() {
  try {
    const response = await fetch("/downloads/release.json", { cache: "no-store" });
    if (!response.ok) throw new Error("release unavailable");
    const release = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(release.version) || !/^\d+\.\d{2}$/.test(release.displayVersion) || !Number.isSafeInteger(release.bytes) || release.bytes <= 0) throw new Error("invalid release");
    const url = new URL(release.downloadUrl, window.location.origin);
    if (url.origin !== window.location.origin || !/^\/downloads\/(orami-\d+\.\d+\.\d+-android\.apk|fit\.apk)$/.test(url.pathname) || url.search || url.hash) throw new Error("invalid download");
    const filename = `orami-${release.version}-android.apk`;
    const detail = `Versão ${release.displayVersion} · Android · ${(release.bytes / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
    for (const link of links) {
      link.href = url.pathname; link.download = filename;
      link.setAttribute("aria-label", `Baixar Orami versão ${release.displayVersion} para Android`);
      const small = link.querySelector("small"); if (small) small.textContent = detail;
    }
    ready = true;
    if (status) status.textContent = `Versão ${release.displayVersion} disponível. Download direto, sem precisar entrar no site.`;
  } catch {
    if (status) status.textContent = "Não foi possível consultar a versão disponível. Atualize a página para tentar novamente.";
    for (const link of links) { link.setAttribute("aria-disabled", "true"); const small = link.querySelector("small"); if (small) small.textContent = "Download temporariamente indisponível"; }
  }
}
void loadRelease();
export {};
