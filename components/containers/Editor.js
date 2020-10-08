import styles from "./Editor.module.css";

import { Typography, Space, Spin, Layout, Row, Col, Divider } from "antd";
import EditorContextProvider, { EditorContext } from "../data/EditorContext";
import { useContext, useEffect, useState } from "react";
import AudioRecordingSection from "../editor/AudioRecordingSection";

import ImagePickerSection from "../editor/ImagePickerSection";
import CreateVideoButton from "../editor/CreateVideoButton";
import dynamic from "next/dynamic";

const { Header, Footer, Sider, Content } = Layout;

const { Title } = Typography;

const ActiveCanvasWithNoSSR = dynamic(() => import("../editor/ActiveCanvas"), {
  ssr: false,
});

export default function EditorContainer() {
  return (
    <EditorContextProvider>
      <InitializeAndShowEditor />
    </EditorContextProvider>
  );
}

function InitializeAndShowEditor() {
  const { initialize } = useContext(EditorContext);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const callServerToInitialize = async () => {
      const collab = await fetch("/api/collab", {
        method: "POST",
        body: null,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(response.message);
        }
        return response.json();
      });

      initialize(collab.id);
      setInitialized(true);
    };
    callServerToInitialize();
  }, []);

  if (!initialized) {
    return (
      <Content className={styles.content}>
        <Spin tip={"Initializing Editor"} />
      </Content>
    );
  }

  return (
    <Layout>
      <Header className={styles.header}>
        <CollabTitle />
      </Header>
      <Divider className={styles.thinSeperator} />
      <Layout>
        <Sider theme="light" width={220}>
          Blah
        </Sider>
        <Divider
          className={`${styles.thinSeperator} ${styles.vertical}`}
          type="vertical"
        />
        <Layout>
          <Content className={styles.content}>
            <Col span={24}>
              <Row justify="center">
                <ActiveCanvasWithNoSSR />
              </Row>
              <Row>
                <ImagePickerSection />
              </Row>
            </Col>
          </Content>
          <Footer>
            <div className={styles.recordAndSendBar}>
              <Space>
                <AudioRecordingSection />
                <CreateVideoButton />
              </Space>
            </div>
          </Footer>
        </Layout>
        <Divider
          className={`${styles.thinSeperator} ${styles.vertical}`}
          type="vertical"
        />
        <Sider theme="light" width={64}>
          Tools
        </Sider>
      </Layout>
    </Layout>
  );
}

function CollabTitle() {
  const { collab, onChangeTitle } = useContext(EditorContext);

  return (
    <div className={styles.titleSection}>
      <Title level={2} editable={{ onChange: onChangeTitle }}>
        {collab.get("title")}
      </Title>
    </div>
  );
}
