import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Spin, Typography, Card, Space } from "antd";
import { SizeMe } from "react-sizeme";
import Head from "next/head";

import styles from "../../styles/Viewer.module.css";

const { Title, Paragraph } = Typography;

const pollUntilCreation = async (id) => {
  const collab = await fetch(`/api/collab/${id}`).then((res) => res.json());

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

const optimalVideDimensions = ({ width, height }) => {
  const videoWidth = Math.min(...[width, height, 960].filter((dim) => dim > 0));

  const videoHeight = Math.floor((9 / 16) * videoWidth);

  return { width: videoWidth, height: videoHeight };
};

const createLink = (id) => {
  return `${process.env.NEXT_PUBLIC_SELF_BASE_PATH}v/${id}`;
};

export default function CollabViewerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [collab, setCollab] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      const collab = await pollUntilCreation(id);
      setCollab(collab);

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
        <Spin />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{collab ? collab.title : "Collabice"}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SizeMe noPlaceholder>
        {({ size }) => {
          const { width, height } = optimalVideDimensions(size);

          if (!size.width && !size.height) {
            return <div style={{ width: "100%", height: "100%" }}></div>;
          }
          return (
            <div className={styles.innerContainer} style={{ width }}>
              <Space direction="vertical">
                <Title level={2}>{collab.title}</Title>
                <video width={width} height={height} controls>
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
          );
        }}
      </SizeMe>
    </div>
  );
}
