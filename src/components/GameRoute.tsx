"use client";

import AutoTheftSection from "@/components/AutoTheft";
import BankSection from "@/components/BankSection";
import EscrowSection from "@/components/EscrowSection";
import GoldMarketplace from "@/components/GoldMarketplace";
import GymnasiumSection from "@/components/Gymnasium";
import JailSection from "@/components/Jail";
import OrganisedCrimeSection from "@/components/OrganisedCrime";
import WhackSection from "@/components/WhackSection";
import { TravelSection } from "@/components/Travel";
import { BulletFactorySection } from "@/components/Venues";
import { useGame } from "@/components/GameContext";

export type GamePage =
  | "Auto Theft"
  | "Bullet Factory"
  | "Escrow"
  | "Gymnasium"
  | "Jail"
  | "Local Bank"
  | "Marketplace"
  | "Organised Crime"
  | "Railway"
  | "Whack";

// A page that needs more from the game frame than cash, for example /railway.
export default function GameRoute({ page }: { page: GamePage }) {
  const g = useGame();

  if (page === "Auto Theft") {
    return (
      <AutoTheftSection
        rankLevel={g.rankLevel}
        energy={g.energy}
        staminaLevel={g.staminaLevel}
        theftLeft={g.theftLeft}
        onActed={g.refresh}
        jailLeft={g.jailLeft}
        isAdmin={g.isAdmin}
        currentCity={g.currentCity}
        onCash={g.setMoney}
        onResult={(r) => {
          g.setEnergy(r.energy);
          g.setMoney(r.money);
          g.setExperience(r.experience);
          g.noteRank(r.rank, r.rankLevel);
        }}
      />
    );
  }
  if (page === "Bullet Factory") {
    return <BulletFactorySection onCash={g.setMoney} onBullets={g.setBullets} />;
  }
  if (page === "Escrow") return <EscrowSection onCash={g.setMoney} onGold={g.setGold} />;
  if (page === "Gymnasium") {
    return <GymnasiumSection onEnergy={g.setEnergy} onLevels={g.onTrainingLevels} />;
  }
  if (page === "Jail") return <JailSection onChanged={g.refresh} onBrokeOut={g.showBreakout} />;
  if (page === "Local Bank") {
    return <BankSection money={g.money} bank={g.bank} onMoney={g.setMoney} onBank={g.setBank} />;
  }
  if (page === "Marketplace") return <GoldMarketplace onCash={g.setMoney} onGold={g.setGold} />;
  if (page === "Organised Crime") return <OrganisedCrimeSection />;
  if (page === "Railway") return <TravelSection onArrive={g.setCurrentCity} isAdmin={g.isAdmin} />;
  return <WhackSection onCash={g.setMoney} isAdmin={g.isAdmin} />;
}
