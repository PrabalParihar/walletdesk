# Demo video (Remotion)

The submission video's picture, made with [Remotion](https://www.remotion.dev). It is silent on purpose: ETHGlobal wants
your own voice (no text-to-speech), so record the voiceover from [docs/WALKTHROUGH.md](../docs/WALKTHROUGH.md) over it.

What is in it (about 2:15 at 1920×1080, 30 fps):

| Time | Scene | Source |
| --- | --- | --- |
| 0:00 | Title | animated |
| 0:05 | The idea: 5 DA in, pool fills 1, a wallet fills 4 | animated |
| 0:16 | 01 The overview (`/`) | screen recording |
| 0:38 | 02 A maker ships a desk (`/desk`) | screen recording, real transactions on the fork |
| 0:52 | 03 An overflow swap through Uniswap's PoolSwapTest (`/live`) | screen recording, real transactions on the fork |
| 1:20 | 04 The price guard skips a desk (`/live`) | screen recording, real transactions on the fork |
| 1:40 | 05 In the code (`/how`, Ctrl K) | screen recording |
| 2:01 | 06 Proof: Sepolia fills, transactions, CRE simulation, tests | animated, numbers from the repo |
| 2:10 | Outro | animated |

The recordings play at their real speed (nothing is sped up); the cursor is drawn from the recorded clicks, and the
captions are tied to markers recorded during capture.

## Make it

```bash
./script/demo.sh                       # in another terminal: Unichain fork, contracts, keeper, UI
```

```bash
cd video && npm install
```

```bash
node capture/capture.cjs               # records the five clips into public/footage/ (needs `cast` on PATH)
```

```bash
npm run studio                         # preview and scrub in the browser
```

```bash
npm run render                         # writes out/walletdesk-demo.mp4
```

In a container without Chrome downloads, point Remotion at an installed Chrome Headless Shell with
`--browser-executable=/path/to/chrome-headless-shell`.

The price-guard clip restarts the keeper with `REFERENCE_PUSH=0` (so it keeps indexing skips but stops refreshing the
reference) and pushes a 0.95 reference from Anvil's dev account, which is the fork's feed forwarder. That stands in for a
market move; on Sepolia the reference comes from the Chainlink CRE workflow.

## Add your voice

Record the script in [docs/WALKTHROUGH.md](../docs/WALKTHROUGH.md) while the video plays, save it as `voice.m4a`, then:

```bash
npx remotion ffmpeg -i out/walletdesk-demo.mp4 -i voice.m4a -map 0:v -map 1:a -c:v copy -c:a aac -shortest out/walletdesk-final.mp4
```

Fonts: Inter and Geist Mono (SIL Open Font License), bundled in `public/fonts`. Remotion is free for individuals and
teams of up to three people; larger companies need a company licence (see remotion.dev/license).
