import "../styles/globals.css";
import "antd/dist/antd.css";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { initializeApp } from "firebase/app";
import ConfigProvider from "server/base/ConfigProvider";
import { AnalyticsService } from "server/service/analytics";

initializeApp(ConfigProvider.FIREBASE_APP_CLIENT_CONFIG);

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || true) {
      const logScreenView = () => {
        AnalyticsService.logEvent("screen_view", {
          firebase_screen: router.pathname,
          query: router.query,
        });
      };

      router.events.on("routeChangeComplete", logScreenView);

      //Logging defualt screen view
      logScreenView();

      //Remvove Event Listener after un-mount
      return () => {
        router.events.off("routeChangeComplete", logScreenView);
      };
    }
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
