<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Game rules (anomaly list, step counts, level progression) live as pure functions in `src/game/logic.ts` with tests in `src/game/logic.test.ts`; keep UI and audio out of it so rules stay testable.
- The stairwell is rendered as SVG from a tiny 3D projection (`src/game/projection.ts` + `src/game/Scene.tsx`) instead of WebGL, to stay SSR-safe and dependency-free.
- Scene colors come from `--scene-*` tokens in `src/styles.css`; never hardcode colors in the renderer.
- Audio is synthesized with Web Audio (`src/game/audio.ts`), created only after a user click; no audio files.
- Progress (logbook, best time, sound pref) is stored in localStorage and read in effects to avoid hydration mismatches.
