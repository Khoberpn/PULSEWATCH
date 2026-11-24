"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  CheckCircle,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Monitors", href: "/monitors", icon: Radio },
  { name: "Incidents", href: "/incidents", icon: ShieldAlert },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Activity Logs", href: "/activity", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-950 text-slate-200 border-r border-slate-900 flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-900">
        <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
          <Zap className="h-5 w-5 fill-current" />
        </div>
        <div>
          <span className="font-bold text-base tracking-wider text-white flex items-center gap-1.5">
            PULSEWATCH
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block -mt-0.5">
            Observability v1.0
          </span>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navigation.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Bottom Service Footer */}
      <div className="p-4 m-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
        <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Core Engine
          </span>
          <span className="text-emerald-400 font-mono text-[11px]">ACTIVE</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Asynchronous monitoring scheduler and SSRF protection engaged.
        </p>
      </div>
    </aside>
  );
};
