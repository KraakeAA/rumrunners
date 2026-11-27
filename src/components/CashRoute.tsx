"use client";

import BootleggingSection from "@/components/Bootlegging";
import HitlistSection from "@/components/HitlistSection";
import HospitalSection from "@/components/HospitalSection";
import LotterySection from "@/components/Lottery";
import SearchSection from "@/components/SearchSection";
import StoreSection from "@/components/Store";
import { GarageSection } from "@/components/Travel";
import { useGame } from "@/components/GameContext";

export type CashPage =
  | "Bootlegging"
  | "Garage"
  | "Hitlist"
  | "Hospital"
  | "Lottery"
  | "Search"
  | "Store";

// A page that only needs to update your cash, for example /hospital.
export default function CashRoute({ page }: { page: CashPage }) {
  const { setMoney } = useGame();
  if (page === "Bootlegging") return <BootleggingSection onCash={setMoney} />;
  if (page === "Garage") return <GarageSection onCash={setMoney} />;
  if (page === "Hitlist") return <HitlistSection onCash={setMoney} />;
  if (page === "Hospital") return <HospitalSection onCash={setMoney} />;
  if (page === "Lottery") return <LotterySection onCash={setMoney} />;
  if (page === "Search") return <SearchSection onCash={setMoney} />;
  return <StoreSection onCash={setMoney} />;
}
