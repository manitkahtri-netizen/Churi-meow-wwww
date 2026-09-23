# KhatriAI launch film

A 53-second launch ad for **ManitPF KhatriAI**, modelled on the structure of the
"Introducing Claude Fable 5.1" launch. Every frame and every note comes from code:
there are no video, image or audio assets.

- `index.html` plays the film in a browser, with sound, scrubbing and restart.
- `render.cjs` exports it to `khatriai-launch-film.mp4` (1920×1080, 30 fps, AAC audio).
- `khatriai-launch-film.mp4` is the rendered ad.

## Scenes

| Time | Scene |
| --- | --- |
| 0:00 | ManitPF mark draws in, then the wordmark appears |
| 0:04.8 | "Introducing ManitPF": the KhatriAI title reveal |
| 0:09.6 | "The world's most advanced model for…": coding, research, agents, knowledge work |
| 0:16.8 | Agentic coding: an editor writes a migration, runs it and passes 2,418 tests |
| 0:24.0 | Benchmarks: KhatriAI against the previous model |
| 0:31.2 | Science: a protein folds and a designed binder docks |
| 0:38.4 | Cost: 25% / 45% / 75% cheaper |
| 0:45.6 | End card: KhatriAI by ManitPF, "Available today" |

The benchmark and pricing figures reuse the ones published for Fable 5.1 and are
illustrative only. The end card says so.

## How it works

Every scene is a pure function of time `t`. `render(t)` sets each element's state for
that instant, so live playback and frame-exact export share one code path. The
soundtrack (pads, arpeggio, kick, risers and bells in D major at 100 BPM) is built
with Web Audio. Live playback schedules it ahead of time, and the export renders the
same score through an `OfflineAudioContext`.

## Re-rendering

```sh
npm i playwright          # uses its bundled Chromium
FFMPEG=/path/to/ffmpeg node render.cjs khatriai-launch-film.mp4
```

`FPS=60` renders at 60 fps. `FROM=24 TO=31` renders only that slice.
