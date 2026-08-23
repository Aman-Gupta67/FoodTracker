import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fc8c2f",
          color: "#ffffff",
          fontSize: 260,
          fontWeight: 600,
        }}
      >
        F
      </div>
    ),
    { width: 512, height: 512 },
  );
}
