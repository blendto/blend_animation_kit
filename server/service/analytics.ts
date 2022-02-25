import {
  getAnalytics,
  logEvent as logEventInFirebase,
} from "firebase/analytics";

const analytics = () => {
  if (typeof window !== "undefined") {
    return getAnalytics();
  } else {
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AnalyticsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function logEvent(eventName: string, params?: { [key: string]: any }) {
    logEventInFirebase(analytics(), eventName, params);
  }
}
