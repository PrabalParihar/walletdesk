import { continueRender, delayRender, staticFile } from "remotion";

// The site's own type, bundled (both SIL Open Font License) so renders need no network:
// Inter for text, Geist Mono for labels, addresses and numbers. Variable fonts cover every weight used.
function loadFont(family: string, file: string, weight: string) {
  if (typeof document === "undefined") return;
  const handle = delayRender(`Loading ${family}`);
  const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, { weight });
  face
    .load()
    .then(() => {
      document.fonts.add(face);
      continueRender(handle);
    })
    .catch((error) => {
      console.error(`Could not load ${family}`, error);
      continueRender(handle);
    });
}

loadFont("Inter", "fonts/Inter-latin.woff2", "400 700");
loadFont("Geist Mono", "fonts/GeistMono-latin.woff2", "400 500");

export const sans = "Inter, system-ui, sans-serif";
export const mono = '"Geist Mono", ui-monospace, monospace';

export const c = {
  ink: "#18181B",
  body: "#4A4A52",
  muted: "#5D5D66",
  faint: "#A1A1AA",
  paper: "#FFFFFF",
  canvas: "#EFEFF1",
  line: "rgba(0,0,0,0.08)",
  pool: "#D6006F", // Uniswap pink, darkened for white text (same token as the site)
  desk: "#0066FA", // maker wallet via 1inch Aqua
  cre: "#375BD2", // Chainlink
  ok: "#047857",
};

export const FPS = 30;
