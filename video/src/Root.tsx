import { Composition } from "remotion";

import { Demo, TOTAL_FRAMES } from "./Demo";
import { FPS } from "./theme";

export function RemotionRoot() {
  return <Composition id="WalletDeskDemo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />;
}
