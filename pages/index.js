import Head from "next/head";
import EditorContainer from "../components/containers/Editor";
import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Collabice</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <EditorContainer />
      </main>

      <footer className={styles.footer}></footer>
    </div>
  );
}
