import Replicate from "replicate";
import ConfigProvider from "server/base/ConfigProvider";
import { Size } from "server/base/models/recipe";

const AspectRatioToSizes: Record<string, Size> = {
  "1:1": { width: 768, height: 768 },
  "9:16": { width: 432, height: 768 },
  "16:9": { width: 768, height: 432 },
  "3:4": { width: 576, height: 768 },
  "4:3": { width: 768, height: 576 },
  "2:3": { width: 512, height: 768 },
  "3:2": { width: 768, height: 512 },
  "4:15": { width: 512, height: 640 },
};

interface ImageGenerationOptions {
  prompt: string;
  aspectRatio: { width: number; height: number };
}

export class ImageGenerator {
  async generate({
    prompt,
    aspectRatio,
  }: ImageGenerationOptions): Promise<string> {
    const targetAR = aspectRatio.width / aspectRatio.height;
    const closestSize = Object.values(AspectRatioToSizes).reduce((acc, cur) => {
      const curAR = cur.width / cur.height;
      const accAR = acc.width / acc.height;
      if (Math.abs(curAR - targetAR) < Math.abs(accAR - targetAR)) {
        return cur;
      }
      return acc;
    }, AspectRatioToSizes["1:1"]);

    const replicate = new Replicate({
      auth: ConfigProvider.REPLICATE_API_TOKEN,
    });

    const imageGenResults = await replicate.run(
      "mcai/realistic-vision-v2.0:bed7774ff9503c3e7971627eb523d7ab2ea12f7b649c9887556747d946d11a73",
      {
        input: {
          prompt: prompt + ", aesthetic image",
          width: closestSize.width,
          height: closestSize.height,
          scheduler: "EulerAncestralDiscrete",
          num_outputs: 1,
          guidance_scale: 7,
          negative_prompt:
            "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime:1.4), text, close up, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck",
          num_inference_steps: 25,
        },
      }
    );

    const imageGenResult: string = imageGenResults[0] as string;
    return imageGenResult;
  }
}
