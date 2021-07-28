import styles from "./InteractionLayer.module.css";

export default function IntearctionLayer({ blend, dimensions }) {
  const { interactions } = blend;
  if (!interactions) {
    return null;
  }

  const elements = interactions.map((interaction, index) => {
    const { userInteraction, metadata } = interaction;

    if (!userInteraction) {
      return null;
    }

    const { options } = userInteraction;

    if (userInteraction.type == "LINK") {
      return (
        <ILLink
          key={index}
          metadata={metadata}
          options={options}
          dimensions={dimensions}
        />
      );
    }

    return null;
  });

  return <div className={styles.interactionLayer}>{elements}</div>;
}

function cleanTarget(target) {
  const hasProtoPrefixed = ["http:", "https:", "tel:", "mailto:"].some(
    (prefix) => target.startsWith(prefix)
  );

  if (hasProtoPrefixed) {
    return target;
  }
  // http fallback
  return "http://" + target;
}

function ILLink({ metadata, options, dimensions }) {
  const { position, size, relativeSize } = metadata;
  const { width: canvasWidth, height: canvasHeight } = relativeSize;
  const { width: videoWidth, height: videoHeight } = dimensions;
  const widthScale = videoWidth / canvasWidth;
  const heightScale = videoHeight / canvasHeight;

  const style = {
    position: "absolute",
    top: position.dy * heightScale,
    left: position.dx * widthScale,
    width: size.width * widthScale,
    height: size.height * heightScale,
  };

  return <a href={cleanTarget(options.target)} style={style} />;
}
