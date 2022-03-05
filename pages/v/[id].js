import * as React from "react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ConfigProvider from "../../server/base/ConfigProvider";
import {
  List,
  Spin,
  Typography,
  Result,
  Drawer,
  Button,
  Row,
  Col,
  Image,
  message,
} from "antd";
import { LinkOutlined } from "@ant-design/icons";

import Head from "next/head";

import styles from "../../styles/Viewer.module.css";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import IntearctionLayer from "../../components/viewer/InteractionLayer";
import { AnalyticsService } from "server/service/analytics";

const { Title, Text } = Typography;

const fetchData = async (id) => {
  return await fetch(`/api/blend/${id}`).then((res) => {
    if (res.status === 404) {
      return null;
    }
    return res.json();
  });
};

const pollUntilCreation = async (id) => {
  const blend = await fetchData(id);

  if (!blend) {
    return null;
  }

  if (blend.status === "GENERATED") {
    return blend;
  }

  await new Promise((r) => setTimeout(r, 2000));

  return await pollUntilCreation(id);
};

const createVideoLink = (blend) => {
  return ConfigProvider.OUTPUT_BASE_PATH + blend?.output?.video.path;
};

const createThumbnailLink = (blend) => {
  return ConfigProvider.OUTPUT_BASE_PATH + blend?.output?.thumbnail.path;
};

const optimalVideoDimensions = (
  { width: windowWidth, height: windowHeight },
  videoResolution
) => {
  if (!videoResolution) {
    return { width: 0, height: 0 };
  }
  const { width, height } = videoResolution;
  var scale = Math.min(windowWidth / width, windowHeight / height);

  return { width: Math.ceil(width * scale), height: Math.ceil(height * scale) };
};

const createLink = (id, remix = false) => {
  var link = `${process.env.NEXT_PUBLIC_SELF_BASE_PATH}v/${id}`;
  if (remix) {
    return `${link}?a=rx`;
  }
  return link;
};

const createCustomSchemeLink = (id) => {
  var link = `blend://blend.to/remix/${id}`;

  return link;
};

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;

  return {
    width,
    height,
  };
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(null);

  useEffect(() => {
    function handleResize() {
      const newDimensions = getWindowDimensions();
      setWindowDimensions(newDimensions);
    }

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}

export default function CollabViewerPage(props) {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(!props.blend);
  const [blend, setBlend] = useState(props.blend);
  const [isDrawerVisible, setDrawerVisibility] = useState(false);
  const windowDimensions = useWindowDimensions();
  let videoDimensions;
  if (windowDimensions) {
    videoDimensions = optimalVideoDimensions(
      windowDimensions,
      blend?.output?.video.resolution
    );
  }

  useEffect(() => {
    async function fetchData() {
      // Check blend from props
      let fetchedBlend = props.blend;

      if (
        !fetchedBlend ||
        ["GENERATED", "DELETED"].includes(fetchedBlend.status)
      ) {
        // 404 or is generated, stop loading
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      fetchedBlend = await pollUntilCreation(id);
      setBlend(fetchedBlend);

      setIsLoading(false);
    }

    if (id) {
      fetchData();
    }
    return () => {};
  }, [id]);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${styles.loader}`}>
        <Spin
          tip={
            "Hey, This video is still being generated. You can hang around here while our lazy ass servers do their job, or check back in later."
          }
        />
      </div>
    );
  }

  if (!blend || blend.status === "DELETED") {
    return (
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the blend you are looking for does not exist."
      />
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{blend?.title ?? "Blend"}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={blend?.title} />
        <meta property="og:description" content={"Made with 😻 with Blend"} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={createLink(blend?.id)} />
        <meta property="og:video" content={createVideoLink(blend)} />
        <meta property="og:video:secure_url" content={createVideoLink(blend)} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="720" />
        <meta property="og:video:height" content="1280" />
        <meta property="og:image" content={createThumbnailLink(blend)} />
        <meta property="og:image:width" content="628" />
        <meta property="og:image:height" content="1200" />

        <meta property="fb:app_id" content="2680324515617353" />

        <meta name="twitter:title" content={blend?.title} />
        <meta name="twitter:description" content={"Made with 😻 with Blend"} />
        <meta name="twitter:image" content={createThumbnailLink(blend)} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className={styles.innerContainer}>
        {videoDimensions ? (
          <VideoLayer
            blend={blend}
            width={videoDimensions.width}
            height={videoDimensions.height}
          />
        ) : null}
      </div>
      <BlendButton onClick={() => setDrawerVisibility(true)} />
      <BlendDrawer
        blend={blend}
        visible={isDrawerVisible}
        onClose={() => setDrawerVisibility(false)}
      />
    </div>
  );
}

function BlendDrawer({ blend, visible, onClose }) {
  const onClick = () => {
    window.location.replace(createCustomSchemeLink(blend.id));
    setTimeout(() => {
      message.error("Couldn't open. Do you have the app?", 2000);
    }, 1000);
    AnalyticsService.logEvent("web_remix_click", { blendId: blend.id });
  };

  return (
    <Drawer
      title="Blend"
      placement={"bottom"}
      closable={true}
      onClose={onClose}
      visible={visible}
      height={"60vh"}
    >
      <Button block type="primary" icon={<LinkOutlined />} onClick={onClick}>
        Remix this Blend
      </Button>
      <Row justify="end">
        <Text>*requires app</Text>
      </Row>

      <Credits blend={blend} />
    </Drawer>
  );
}

function Credits({ blend }) {
  const credits = blend.externalImages.reduce((resultArray, extImg) => {
    if (extImg.source == "UNSPLASH" && extImg.credit != null) {
      const { credit } = extImg;
      resultArray.push({
        thumbnail: `${extImg.url}&fm=jpg&w=100&fit=max`,
        authorName: credit.name,
        authorUrl: `${credit.url}?utm_source=djfy&utm_medium=referral`,
        sourceLabel: "Unsplash",
        sourceUrl: "https://unsplash.com/?utm_source=djfy&utm_medium=referral",
      });
      return resultArray;
    }
    return resultArray;
  }, []);
  if (!credits.length) {
    return null;
  }
  return (
    <Col>
      <Title level={3}>Credits</Title>
      <List
        itemLayout="horizontal"
        dataSource={credits}
        renderItem={(item) => (
          <List.Item
            extra={
              <a href={item.sourceUrl} target="_blank">
                {item.sourceLabel}
              </a>
            }
          >
            <List.Item.Meta
              avatar={<Image width={50} src={item.thumbnail} preview={false} />}
              title={
                <span>
                  Photo by{" "}
                  <a href={item.authorUrl} target="_blank">
                    {item.authorName}
                  </a>
                </span>
              }
            />
          </List.Item>
        )}
      />
    </Col>
  );
}

function BlendButton({ onClick }) {
  return (
    <div className={styles.blendButton} onClick={onClick}>
      <span className={styles.text}>Blend</span>
    </div>
  );
}

const VideoLayer = React.memo(function ({ blend, width, height }) {
  return [
    <div key={"video-layer"} style={{ width, height }}>
      <video
        height={height}
        width={width}
        controls={false}
        autoPlay
        muted
        playsInline
        loop
      >
        <source src={createVideoLink(blend)} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>,
    <IntearctionLayer
      key={"il"}
      blend={blend}
      dimensions={{ width, height }}
    />,
  ];
});

export async function getServerSideProps({ params }) {
  const { id } = params;

  const blendService = diContainer.get(TYPES.BlendService);
  const blend = await blendService.getBlend(id);

  return {
    props: {
      blend,
    },
  };
}
