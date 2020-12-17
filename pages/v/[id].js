import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Spin, Typography, Card, Space, Result } from "antd";
import Head from "next/head";

import styles from "../../styles/Viewer.module.css";
import { _getCollab } from "../api/collab/[id]";

const { Title, Paragraph } = Typography;

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

const OUTPUT_BUCKET_BASE_PATH =
  "https://collabice-output.s3.us-east-2.amazonaws.com/";

const createVideoLink = (collab) => {
  return OUTPUT_BUCKET_BASE_PATH + collab?.filePath;
};

const createThumbnailLink = (collab) => {
  return OUTPUT_BUCKET_BASE_PATH + collab?.thumbnail;
};

const optimalVideDimensions = ({ width, height }) => {
  const videoWidth = Math.min(...[width, height, 960].filter((dim) => dim > 0));

  const videoHeight = Math.floor((9 / 16) * videoWidth);

  return { width: videoWidth, height: videoHeight };
};

const createLink = (id) => {
  return `${process.env.NEXT_PUBLIC_SELF_BASE_PATH}v/${id}`;
};

export default function CollabViewerPage(props) {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(!props.collab);
  const [collab, setCollab] = useState(props.collab);

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
    return () => { };
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
        <title>{collab ? collab.title : "Collabice"}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={collab?.title} />
        <meta property="og:description" content={"DJfy your ideas"} />
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
        <meta name="twitter:description" content={"DJfy your ideas"} />
        <meta name="twitter:image" content={createThumbnailLink(collab)} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className={styles.innerContainer}>
        <Space direction="vertical">
          <Title level={2}>{collab.title}</Title>
          <video controls autoPlay loop muted>
            <source src={createVideoLink(collab)} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <Card title="Share">
            <span>
              <Paragraph copyable>{createLink(collab.id)}</Paragraph>
            </span>
          </Card>
        </Space>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { id } = params;

  const collab = (await _getCollab(id)) || null;

  return {
    props: {
      collab,
    },
  };
}
