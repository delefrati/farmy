import { useEffect } from 'react';
import { createGame, destroyGame } from './game/main';

function App() {
  useEffect(() => {
    const container = document.getElementById('game-root');
    if (!container) {
      return;
    }

    createGame(container);

    return () => {
      destroyGame();
    };
  }, []);

  return (
    <main>
      <h1>Farmy</h1>
      <div id="game-root" />
    </main>
  );
}

export default App;
