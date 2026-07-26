// @ts-nocheck
import { AbsoluteFill, Img, Video, Audio, Sequence, useVideoConfig, useCurrentFrame, interpolate, staticFile } from "remotion";
import { Project, Scene } from "@cinovidyo/shared";

const resolveMediaSource = (source: string) => {
  if (!source) return null;
  if (/^(https?:|data:|file:|\/)/.test(source)) {
    return source;
  }
  return staticFile(source);
};

export const MainVideo: React.FC<{ project: Project; scenes: Scene[]; audioUrl: string | null }> = ({
  project,
  scenes,
  audioUrl,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#030712" }}>
      {scenes.map((scene, index) => {
        const startFrame = scenes.slice(0, index).reduce((acc, s) => acc + s.durationInFrames, 0);

        // Motion interpolation
        const scale =
          scene.motion === "zoom_in"
            ? interpolate(frame - startFrame, [0, scene.durationInFrames], [1, 1.18])
            : scene.motion === "zoom_out"
            ? interpolate(frame - startFrame, [0, scene.durationInFrames], [1.18, 1])
            : 1;

        const translateX =
          scene.motion === "pan_right"
            ? interpolate(frame - startFrame, [0, scene.durationInFrames], [0, 40])
            : scene.motion === "pan_left"
            ? interpolate(frame - startFrame, [0, scene.durationInFrames], [0, -40])
            : 0;

        // Transition fade
        const opacity =
          scene.transition === "fade"
            ? interpolate(frame - startFrame, [0, 15], [0, 1], { extrapolateRight: "clamp" })
            : 1;

        const mediaSrc = scene.assetId ? resolveMediaSource(scene.assetId) : null;
        const isVideo = scene.bgType === "video" || (scene.assetId && scene.assetId.endsWith(".mp4"));

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={scene.durationInFrames}>
            <AbsoluteFill style={{ opacity }}>
              {mediaSrc ? (
                isVideo ? (
                  <Video
                    src={mediaSrc}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Img
                    src={mediaSrc}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: `scale(${scale}) translateX(${translateX}px)`,
                    }}
                  />
                )
              ) : (
                /* Educational / Text Slide Canvas */
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #030712 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#a78bfa",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                      marginBottom: 20,
                    }}
                  >
                    BÖLÜM {index + 1}
                  </div>
                </div>
              )}

              {/* Subtitle / Text Overlay */}
              {scene.subtitle && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 120,
                    left: 20,
                    right: 20,
                    textAlign: "center",
                    color: "white",
                    fontSize: 34,
                    fontWeight: 700,
                    textShadow: "0 4px 12px rgba(0,0,0,0.9)",
                    backgroundColor: "rgba(3, 7, 18, 0.75)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(124, 58, 237, 0.3)",
                    borderRadius: 16,
                    padding: "16px 24px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  {scene.subtitle}
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {audioUrl && <Audio src={audioUrl} />}
    </AbsoluteFill>
  );
};
