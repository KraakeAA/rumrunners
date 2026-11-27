"use client";

import AdminSection from "@/components/AdminSection";
import AutoTheftSection from "@/components/AutoTheft";
import BankSection from "@/components/BankSection";
import CrewSection from "@/components/CrewSection";
import EscrowSection from "@/components/EscrowSection";
import GoldMarketplace from "@/components/GoldMarketplace";
import GymnasiumSection from "@/components/Gymnasium";
import JailSection from "@/components/Jail";
import MailboxSection from "@/components/Mailbox";
import OrganisedCrimeSection from "@/components/OrganisedCrime";
import SendLetterSection from "@/components/SendLetter";
import WhackSection from "@/components/WhackSection";
import { TravelSection } from "@/components/Travel";
import { BulletFactorySection } from "@/components/Venues";
import { useGame } from "@/components/GameContext";

export type GamePage =
  | "Admin"
  | "Auto Theft"
  | "Bullet Factory"
  | "Crew"
  | "Escrow"
  | "Gymnasium"
  | "Jail"
  | "Local Bank"
  | "Mailbox"
  | "Marketplace"
  | "Organised Crime"
  | "Railway"
  | "Send Letter"
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
  if (page === "Admin") return g.staffLevel >= 2 ? <AdminSection staff={g.staffLevel} /> : null;
  if (page === "Crew") return <CrewSection onCash={g.setMoney} isAdmin={g.isAdmin} playerId={g.playerId} />;
  if (page === "Mailbox") {
    return (
      <MailboxSection
        onOpenOc={() => g.go("Organised Crime")}
        onReply={g.openLetter}
        refreshKey={g.latestMailId}
        onChanged={g.mailChanged}
      />
    );
  }
  if (page === "Send Letter") {
    return <SendLetterSection key={g.letterTo} initialTo={g.letterTo} quote={g.letterQuote} />;
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
