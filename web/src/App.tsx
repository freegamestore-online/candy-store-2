import { GameShell, GameTopbar } from "@freegamestore/games";
import { useEffect, useRef, useState } from "react";
import { startGame } from "./game";

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stop = startGame(host, setScore);
    return stop;
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="Candy Store 2" score={score} />}>
      <div ref={hostRef} className="w-full h-full touch-none" />
    </GameShell>
  );
}
