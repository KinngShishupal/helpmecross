# Game art & audio

All art and audio is generated from code, so there are no third-party assets.

| What | Source | Output |
| --- | --- | --- |
| Illustrations (characters, boat, scenery, UI glyphs) | `scripts/generate-art.js` | `art/svg/*.svg` and `art/manifest.json` |
| PNGs used by the app | `scripts/rasterize-art.js` | `src/assets/images/*.png` |
| Sound effects + music loop | `scripts/generate-audio.js` | `android/app/src/main/res/raw/*.wav` |
| App icon, logo, Play Store graphics | `scripts/generate-brand.js` | `android/.../res/mipmap-*`, iOS `AppIcon.appiconset`, `store/brand`, `store/play` |

Regenerate the art. The rasterizer needs `@resvg/resvg-js`. Install it into a
scratch folder (not the app, and not globally), then run:

```bash
node scripts/generate-art.js
NODE_PATH=<scratch>/node_modules node scripts/rasterize-art.js art src/assets/images
```

Regenerate the icon, logo and store graphics (built from the sprites above, so
run it after the art). It also needs `pngjs` in the scratch folder, and uses the
Windows fonts Segoe UI Black / Arial Black for the title:

```bash
NODE_PATH=<scratch>/node_modules node scripts/generate-brand.js
```

Regenerate the audio (no dependencies):

```bash
node scripts/generate-audio.js
```

Audio is played by the small native module in
`android/app/src/main/java/com/kinngshishupal/helpmecross/GameAudioModule.kt`.
iOS has no audio module yet; the game runs silently there.
