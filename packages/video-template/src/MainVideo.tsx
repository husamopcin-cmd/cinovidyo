// @ts-nocheck
import { AbsoluteFill, Img, Audio, Sequence, useVideoConfig, spring, useCurrentFrame, interpolate, staticFile } from "remotion";
import { Project, Scene } from "@cinovidyo/shared";

const resolveMediaSource = (source: string) => {
  if (/^(https?:|data:|file:|\/)/.test(source)) {
    return source;
  }

  return staticFile(source);
};

export const MainVideo: React.FC<{ project: Project, scenes: Scene[], audioUrl: string | null }> = ({ project, scenes, audioUrl }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenes.map((scene, index) => {
        const startFrame = scenes.slice(0, index).reduce((acc, s) => acc + s.durationInFrames, 0);
        
        // Simple Ken Burns
        const scale = scene.motion === "zoom_in" ? interpolate(frame - startFrame, [0, scene.durationInFrames], [1, 1.2]) : 
                      scene.motion === "zoom_out" ? interpolate(frame - startFrame, [0, scene.durationInFrames], [1.2, 1]) : 1;
        const translateX = scene.motion === "pan_right" ? interpolate(frame - startFrame, [0, scene.durationInFrames], [0, 50]) : 
                           scene.motion === "pan_left" ? interpolate(frame - startFrame, [0, scene.durationInFrames], [0, -50]) : 0;

        // Transitions (simple fade)
        const opacity = scene.transition === "fade" ? interpolate(frame - startFrame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : 1;

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={scene.durationInFrames}>
            <AbsoluteFill style={{ opacity }}>
              <Img src={resolveMediaSource(scene.assetId)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${translateX}px)` }} />
              {scene.subtitle && (
                <div style={{ position: "absolute", bottom: 100, width: "100%", textAlign: "center", color: "white", fontSize: 40, textShadow: "2px 2px 4px black", backgroundColor: "rgba(0,0,0,0.5)", padding: "10px" }}>
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
