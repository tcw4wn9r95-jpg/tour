"use client";
import { Building2, Church, Eye, Landmark, Leaf, MapPin, Palette, ShoppingBasket, Trees, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import type { Photo as PhotoT, StopCategory } from "@/lib/types";

const ICONS: Record<StopCategory, typeof MapPin> = {
  food: UtensilsCrossed,
  architecture: Building2,
  history: Landmark,
  museum: Palette,
  culture: Palette,
  nature: Trees,
  viewpoint: Eye,
  market: ShoppingBasket,
  neighborhood: MapPin,
  religious: Church,
};

const GRADIENTS: Record<StopCategory, string> = {
  food: "from-orange-400 to-rose-500",
  architecture: "from-sky-500 to-indigo-600",
  history: "from-amber-500 to-orange-700",
  museum: "from-fuchsia-500 to-purple-700",
  culture: "from-pink-500 to-violet-600",
  nature: "from-emerald-400 to-teal-600",
  viewpoint: "from-cyan-400 to-blue-600",
  market: "from-lime-500 to-emerald-600",
  neighborhood: "from-slate-400 to-slate-600",
  religious: "from-yellow-500 to-amber-700",
};

export function CategoryIcon({ category, className }: { category: StopCategory; className?: string }) {
  const Icon = ICONS[category] ?? Leaf;
  return <Icon className={className} />;
}

export function Photo({
  photo,
  category = "neighborhood",
  alt,
  className = "",
  iconClass = "size-8",
  hideIcon = false,
}: {
  photo?: PhotoT;
  category?: StopCategory;
  alt: string;
  className?: string;
  iconClass?: string;
  hideIcon?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br text-white/90 ${GRADIENTS[category] ?? GRADIENTS.neighborhood} ${className}`}>
        {!hideIcon && <CategoryIcon category={category} className={iconClass} />}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo.url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
