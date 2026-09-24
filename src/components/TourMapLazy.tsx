"use client";
import dynamic from "next/dynamic";

export const TourMapLazy = dynamic(() => import("./TourMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-card-2" />,
});
