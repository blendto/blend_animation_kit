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

export namespace AnalyticsService {
  export function logEvent(eventName: string, params?: { [key: string]: any }) {
    logEventInFirebase(analytics(), eventName, params);
  }
}
