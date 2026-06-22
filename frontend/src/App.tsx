import { useEffect } from 'react';
import { createGame, destroyGame } from './game/main';

function App() {
  useEffect(() => {
    const container = document.getElementById('game-root');
    if (!container) {
      return;
    }

    createGame(container);

    // Best-effort: force landscape on mobile. Orientation lock generally only
    // works while fullscreen on Android Chrome and is unsupported on iOS Safari
    // (the #rotate-notice overlay is the fallback there).
    const lockLandscape = async (): Promise<void> => {
      const orientation = screen.orientation as
        | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
        | undefined;
      if (!orientation?.lock) {
        return;
      }
      try {
        await orientation.lock('landscape');
      } catch {
        /* not allowed (needs fullscreen / unsupported) — overlay handles it */
      }
    };

    const enterImmersive = async (): Promise<void> => {
      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      try {
        if (!document.fullscreenElement) {
          if (root.requestFullscreen) {
            await root.requestFullscreen();
          } else if (root.webkitRequestFullscreen) {
            await root.webkitRequestFullscreen();
          }
        }
      } catch {
        /* fullscreen denied — still attempt the lock */
      }
      await lockLandscape();
    };

    void lockLandscape();
    // Fullscreen + orientation lock must be triggered by a user gesture.
    window.addEventListener('pointerdown', enterImmersive, { once: true });

    return () => {
      window.removeEventListener('pointerdown', enterImmersive);
      destroyGame();
    };
  }, []);

  return (
    <main>
      <h1>Farmy</h1>
      <div id="game-root" />
      <div id="rotate-notice" aria-hidden="true">
        <div className="rotate-icon">📱</div>
        <p>Rotate your device to landscape to play Farmy</p>
      </div>
    </main>
  );
}

export default App;

