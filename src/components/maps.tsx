"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const Loading = () => (
  <div className="grid size-full place-items-center bg-surface-2 text-sm text-faint">
    <MapPin className="animate-pulse" />
  </div>
);

export const ResultsMap = dynamic(() => import("./maps-impl").then((m) => m.ResultsMapImpl), { ssr: false, loading: Loading });
export const AreaMap = dynamic(() => import("./maps-impl").then((m) => m.AreaMapImpl), { ssr: false, loading: Loading });
export const PinPicker = dynamic(() => import("./maps-impl").then((m) => m.PinPickerImpl), { ssr: false, loading: Loading });
