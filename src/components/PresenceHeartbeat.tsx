
"use client";

import { useEffect } from "react";

export default function PresenceHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/presence", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // Retry on the next heartbeat.
      }
    };

    sendHeartbeat();

    const interval = window.setInterval(sendHeartbeat, 60000);

    return () => window.clearInterval(interval);
  }, []);

  return null;
}
