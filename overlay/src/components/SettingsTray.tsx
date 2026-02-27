import React from "react";
import { useStatus } from "../hooks/useStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { SettingsStatus } from "./SettingsStatus";
import { SettingsList } from "./SettingsList";

const SettingsTray = () => {
  const { recording, snippets, statusPort } = useStatus();

  return (
    <div className="w-full h-full glass-panel text-zinc-100 flex flex-col select-none p-4 rounded-xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] via-transparent to-rose-500/[0.02] pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between pb-3 mb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          {/* Audio wave icon */}
          <div className="flex items-end gap-[2px] h-4">
            <span
              className={`w-[3px] rounded-full transition-all duration-300 ${
                recording
                  ? "bg-red-400 h-2 animate-[pulse_0.5s_ease-in-out_infinite]"
                  : "bg-zinc-600 h-1.5"
              }`}
            />
            <span
              className={`w-[3px] rounded-full transition-all duration-300 ${
                recording
                  ? "bg-red-400 h-4 animate-[pulse_0.5s_ease-in-out_infinite_0.1s]"
                  : "bg-zinc-600 h-3"
              }`}
            />
            <span
              className={`w-[3px] rounded-full transition-all duration-300 ${
                recording
                  ? "bg-red-400 h-2.5 animate-[pulse_0.5s_ease-in-out_infinite_0.2s]"
                  : "bg-zinc-600 h-2"
              }`}
            />
          </div>
          <span className="font-semibold text-[13px] tracking-tight gradient-text">
            Stream
          </span>
        </div>
        <span
          className={`status-badge px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
            recording ? "status-live" : "status-idle"
          }`}
        >
          {recording && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          )}
          {recording ? "Live" : "Idle"}
        </span>
      </div>

      <Tabs
        defaultValue="status"
        className="relative flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid w-full grid-cols-2 p-1 rounded-lg bg-black/20 border border-white/[0.04]">
          <TabsTrigger
            value="status"
            className="text-xs font-medium text-zinc-400 rounded-md py-1.5 transition-all duration-200
              data-[state=active]:bg-white/[0.08] data-[state=active]:text-zinc-100 data-[state=active]:shadow-sm
              hover:text-zinc-300"
          >
            Status
          </TabsTrigger>
          <TabsTrigger
            value="snippets"
            className="text-xs font-medium text-zinc-400 rounded-md py-1.5 transition-all duration-200
              data-[state=active]:bg-white/[0.08] data-[state=active]:text-zinc-100 data-[state=active]:shadow-sm
              hover:text-zinc-300"
          >
            Snippets
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="status"
          className="flex-1 mt-4 animate-[fade-in_0.2s_ease-out] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <SettingsStatus />
        </TabsContent>
        <TabsContent
          value="snippets"
          className="flex-1 overflow-hidden mt-4 animate-[fade-in_0.2s_ease-out] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <SettingsList items={snippets} statusPort={statusPort} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsTray;
