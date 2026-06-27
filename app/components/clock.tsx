"use client";

import { Code } from "@mantine/core";
import { useEffect, useState } from "react";

export default function Clock({
  background,
  color,
}: {
  background: string;
  color: string;
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    update();

    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Code
      fw={700}
      style={{
        background,
        color,
      }}
    >
      {time}
    </Code>
  );
}