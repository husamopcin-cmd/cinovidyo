import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

const FPS = 30;
const WIDTH = 720;
const HEIGHT = 1280;

const getTotalFrames = (scenes: Array<{ durationInFrames?: number }>) => {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("CinoVidyo render requires at least one scene.");
  }

  return scenes.reduce((sum, scene, index) => {
    const durationInFrames = scene.durationInFrames;

    if (typeof durationInFrames !== "number" || !Number.isInteger(durationInFrames) || durationInFrames <= 0) {
      throw new Error(`Scene ${index + 1} must have a positive durationInFrames value.`);
    }

    return sum + durationInFrames;
  }, 0);
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CinoVidyo"
        component={MainVideo}
        durationInFrames={FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={({ props }) => ({
          durationInFrames: getTotalFrames(props.scenes),
          fps: FPS,
          width: WIDTH,
          height: HEIGHT,
        })}
        defaultProps={{
          project: {
            id: "test",
            name: "Test",
            duration: 15,
            ratio: "9:16",
            status: "DRAFT",
            voiceMethod: "file",
            voiceText: null,
            voiceProfile: null,
          },
          scenes: [],
          audioUrl: null
        }}
      />
    </>
  );
};