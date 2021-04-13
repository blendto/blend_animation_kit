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
import { _getCollab } from "../api/collab/[id]";
import IntearctionLayer from "../../components/viewer/InteractionLayer";

const { Title, Text } = Typography;

const fetchData = async (id) => {
  return await fetch(`/api/collab/${id}`).then((res) => {
    if (res.status === 404) {
      return null;
    }
    return res.json();
  });
};

const pollUntilCreation = async (id) => {
  const collab = await fetchData(id);

  if (!collab) {
    return null;
  }

  if (collab.status === "GENERATED") {
    return collab;
  }

  await new Promise((r) => setTimeout(r, 2000));

  return await pollUntilCreation(id);
};

const createVideoLink = (collab) => {
  return ConfigProvider.OUTPUT_BASE_PATH + collab?.filePath;
};

const createThumbnailLink = (collab) => {
  return ConfigProvider.OUTPUT_BASE_PATH + collab?.thumbnail;
};

const optimalVideoDimensions = ({ width, height }) => {
  var scale = Math.min(width / 720, height / 1280);

  return { width: Math.ceil(720 * scale), height: Math.ceil(1280 * scale) };
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
  const [isLoading, setIsLoading] = useState(!props.collab);
  const [collab, setCollab] = useState(props.collab);
  const [isDrawerVisible, setDrawerVisibility] = useState(false);
  const windowDimensions = useWindowDimensions();
  let videoDimensions;
  if (windowDimensions) {
    videoDimensions = optimalVideoDimensions(windowDimensions);
  }

  useEffect(() => {
    async function fetchData() {
      // Check collab from props
      let fetchedCollab = props.collab;

      if (!fetchedCollab || fetchedCollab.status === "GENERATED") {
        // 404 or is generated, stop loading
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      fetchedCollab = await pollUntilCreation(id);
      setCollab(fetchedCollab);

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

  if (!collab) {
    return (
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the collab you are looking for does not exist."
      />
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{collab?.title ?? "Blend"}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={collab?.title} />
        <meta property="og:description" content={"Made with 😻 with Blend"} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={createLink(collab?.id)} />
        <meta property="og:video" content={createVideoLink(collab)} />
        <meta
          property="og:video:secure_url"
          content={createVideoLink(collab)}
        />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="720" />
        <meta property="og:video:height" content="1280" />
        <meta property="og:image" content={createThumbnailLink(collab)} />
        <meta property="og:image:width" content="628" />
        <meta property="og:image:height" content="1200" />

        <meta property="fb:app_id" content="2680324515617353" />

        <meta name="twitter:title" content={collab?.title} />
        <meta name="twitter:description" content={"Made with 😻 with Blend"} />
        <meta name="twitter:image" content={createThumbnailLink(collab)} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className={styles.innerContainer}>
        {videoDimensions ? (
          <VideoLayer
            collab={collab}
            width={videoDimensions.width}
            height={videoDimensions.height}
          />
        ) : null}
      </div>
      <BlendButton onClick={() => setDrawerVisibility(true)} />
      <BlendDrawer
        collab={collab}
        visible={isDrawerVisible}
        onClose={() => setDrawerVisibility(false)}
      />
      {/* <ShareCard collab={collab} dimensions={videoDimensions} /> */}
    </div>
  );
}

function BlendDrawer({ collab, visible, onClose }) {
  const onClick = () => {
    window.location.replace(createCustomSchemeLink(collab.id));
    setTimeout(() => {
      message.error("Couldn't open. Do you have the app?", 2000);
    }, 1000);
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

      <Credits collab={collab} />
    </Drawer>
  );
}

function Credits({ collab }) {
  const credits = collab.externalImages.reduce((resultArray, extImg) => {
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

const VideoLayer = React.memo(function ({ collab, width, height }) {
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
        <source src={createVideoLink(collab)} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>,
    <IntearctionLayer
      key={"il"}
      collab={collab}
      dimensions={{ width, height }}
    />,
  ];
});

export async function getServerSideProps({ params }) {
  const { id } = params;

  const collab = (await _getCollab(id)) || null;

  return {
    props: {
      collab,
    },
  };
}
