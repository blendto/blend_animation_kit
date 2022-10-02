import styles from "styles/custom404.module.css";

export default function Custom404() {
  return (
    <div className={styles.container}>
      <div className={styles.body}>
        <div>
          <div>404</div>
          <div>
            <img
              src={"img/404.svg"}
              alt="Not Found"
              className={styles.image404}
            />
          </div>
          <div>
            <div>Didn’t find anything here!</div>
            <div>
              <a href={"/"} className={styles.link}>Visit our homepage</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
