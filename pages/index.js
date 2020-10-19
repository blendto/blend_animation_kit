import Head from "next/head";
import EditorContainer from "../components/containers/Editor";
import styles from "../styles/Home.module.css";
import { Layout, Row, Col } from "antd";
const { Header, Footer, Sider, Content } = Layout;

export default function Home() {
  return (
    <Layout className={styles.container}>
      <Head>
        <title>DJfy</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <EditorContainer />
    </Layout>
  );
}
