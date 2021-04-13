import Head from "next/head";
import styles from "../styles/Home.module.css";
import { Layout, Row, Col, Typography } from "antd";
const { Header, Footer, Sider, Content } = Layout;
const { Title, Text, Link } = Typography;

export default function Home() {
  return (
    <Layout>
      <Head>
        <title>Blend</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Content>
        <Col>
          <Row justify="center">
            <Title>Why are you here?</Title>
          </Row>
        </Col>
        <Col>
          <Row justify="center">
            <Col>
              <Row>Hmm...</Row>
              <Row>I see no reason for you to be here.</Row>
              <Row>Are you lost?</Row>
              <Row>
                Send us a mail at &nbsp;
                <Link href="mailto:contact@blend.to">
                  contact@blend.to
                </Link>{" "}
                &nbsp; if you are.
              </Row>
            </Col>
          </Row>
        </Col>
      </Content>
    </Layout>
  );
}
