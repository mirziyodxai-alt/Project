# The Lake That Killed Without a Sound

A 60-second animated short about the Lake Nyos disaster (Cameroon, 21 August 1986). It's drawn entirely in code on an HTML canvas: stylized "cartoon 3D" sets with time-of-day lighting, a colour grade, film grain, subtitles, and an ambient score generated with Web Audio.

## Watch it

Open `index.html` in a browser (no build step or server needed) and press **Play**. You can also:

- **Space**: play or pause
- **Scrub bar**: jump to any moment
- **Subtitles / Sound**: turn each on or off

## Export an MP4

```bash
npm install                     # installs Playwright (headless Chromium)
FFMPEG=/path/to/ffmpeg npm run render
```

This writes `renders/lake-nyos.mp4` (1920×1080, 30 fps, H.264 + AAC). The frames and the soundtrack are deterministic, so every render comes out identical.

The export needs an `ffmpeg` build with libx264. If `ffmpeg` is on your `PATH`, you don't need to set `FFMPEG`. Options:

| Flag | Meaning |
| --- | --- |
| `--no-subs` | render without burned-in subtitles |
| `--fps 60` | frame rate |
| `--from 22 --to 31` | render only part of the film |
| `--out file.mp4` | output path |

To preview single frames as JPEGs, run `node tools/snap.mjs out_dir 2.5 33 57`.

## Shot list

| Time | Subtitle | Shot |
| --- | --- | --- |
| 0:00–0:05 | On August 21st, 1986... an entire village fell asleep. | Moonlit village beside the crater lake. Windows go dark one by one as the camera pushes slowly toward the still water. Crickets. |
| 0:05–0:10 | By sunrise... most of them were dead. | Time-lapse from night to sunrise, then a glide down an empty street. A bird sits on a fence and doesn't fly. The crickets have stopped. |
| 0:10–0:16 | There were no explosions... no warning... no screams. | Close-ups: a tree and an empty swing in the wind, laundry and an open door, a cold cooking fire and a spilled basket. |
| 0:16–0:22 | The only witness... was the lake. | The camera turns to the lake under a blue-green grade. Faint bubbles break the surface. |
| 0:22–0:31 | Deep below the surface... millions of tons of carbon dioxide had been trapped for centuries. | Cutaway of the crater: layered water, CO₂ pockets on the floor, and volcanic gas seeping up from magma below. |
| 0:31–0:40 | Then... something released it. | A rockfall disturbs the layers and the gas erupts upward in slow motion. On the surface, the lake churns and a cloud rises. |
| 0:40–0:49 | The cloud couldn't be seen... or smelled. | Grey mist flows downhill between the houses. Inside one house a family sleeps. An aerial view follows the cloud along the valleys. |
| 0:49–0:56 | Because it was heavier than air... it pushed the oxygen away. | Diagram: CO₂ settles along the ground and pushes the oxygen-rich air upward. |
| 0:56–1:00 | By morning... more than 1,700 people were gone. | The lake at sunrise, peaceful again. Fade to black: *"Sometimes... the deadliest disasters make no sound."* |

Nothing on screen is graphic. The sleeping villagers are only ever shown alive and unaware.

## Code layout

| File | Contents |
| --- | --- |
| `src/util.js` | Seeded random numbers, noise, easing, colour helpers |
| `src/env.js` | Time-of-day lighting: sky colours, ambient and key light, haze |
| `src/draw.js` | Parallax camera, sky, terrain, huts, houses, trees, grass |
| `src/valley.js` | The main set: lake, village, eruption, the flowing CO₂ cloud |
| `src/scenes.js` | Street, close-ups, lake surface, interior, aerial view, diagram |
| `src/cutaway.js` | The underwater cross-section and the eruption |
| `src/post.js` | Vignette, grain, letterbox, fades, subtitles, title card |
| `src/timeline.js` | The edit: shots, camera moves, cross-fades, subtitle timings |
| `src/audio.js` | The score, rendered offline so it plays in sync and exports to WAV |
| `src/main.js` | The player |
| `tools/` | MP4 export and frame snapshots (Playwright) |

To change timings or camera moves, edit `SHOTS` and `SUBS` in `src/timeline.js`.

Fonts: Cormorant Garamond and Inter, both under the SIL Open Font License (see `assets/fonts/`).
