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
  // Dark, like the site's default theme (Designeer-style).
  ink: "#F4F4F5",
  body: "#C9C9CF",
  muted: "#A1A1AA",
  faint: "#8B8B94",
  paper: "#0B0B0C",
  raised: "#141416",
  sunken: "#1C1C1F",
  canvas: "#060607",
  line: "rgba(255,255,255,0.08)",
  hatch: "rgba(255,255,255,0.07)",
  link: "#7CB4FF",
  pool: "#D6006F", // Uniswap pink, white text 5.1:1 (same token as the site)
  desk: "#0066FA", // maker wallet via 1inch Aqua
  cre: "#375BD2", // Chainlink
  ok: "#34D399",
};

export const FPS = 30;
