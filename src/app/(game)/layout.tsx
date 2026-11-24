import { Suspense, type ReactNode } from "react";
import GameShell from "@/components/GameShell";
import { loadGame } from "@/lib/load-game";

// The frame around every game page: the header, the menu, your cash and energy.
// It loads once and stays in place while you move from page to page.
export default async function GameLayout({ children }: { children: ReactNode }) {
  const game = await loadGame();
  if (game.kind === "screen") return <>{game.element}</>;

  return (
    <Suspense fallback={null}>
      <GameShell {...game.props}>{children}</GameShell>
    </Suspense>
  );
}
