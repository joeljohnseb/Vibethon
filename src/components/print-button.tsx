"use client";
import { Printer } from "lucide-react";
import { buttonClass } from "./ui";
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={buttonClass("secondary", "sm")}>
      <Printer size={15} /> Print / save PDF
    </button>
  );
}
