import { ImageResponse } from "next/og";

export const runtime = "edge";

// Maskable icons need the glyph inside the ~80% "safe zone" — the outer
// ring gets clipped by whatever shape mask the OS applies.
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
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "70%",
            height: "70%",
            color: "#ffffff",
            fontSize: 200,
            fontWeight: 600,
          }}
        >
          F
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
