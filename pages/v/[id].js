import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Spin, Typography, Card, Space, Result } from "antd";
import { SizeMe } from "react-sizeme";
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
  const [isLoading, setIsLoading] = useState(true);
  const [collab, setCollab] = useState(null);

  useEffect(() => {
    async function fetchData() {
      // Use collab from props
      let fetchedCollab = props.collab;
      setCollab(fetchedCollab);

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
        <Spin />
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

export async function getServerSideProps({ params }) {
  const { id } = params;

  const collab = (await _getCollab(id)) || null;

  return {
    props: {
      collab,
    },
  };
}
