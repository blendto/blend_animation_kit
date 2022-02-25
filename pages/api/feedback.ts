import DynamoDB from "server/external/dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";
import ConfigProvider from "server/base/ConfigProvider";

const DEFAULT_LOCALE = "en_US";
interface FeedbackConfigDBEntry {
  key: string;
  version: string;
  data: object;
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "GET":
      await getFeedbackOptions(req, res);
      break;

    default:
      res.status(404).json({ code: 404, message: "Invalid request" });
  }
};

const getFeedbackOptions = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const feedbackConfig = (await DynamoDB._().getItem({
    TableName: ConfigProvider.CONFIG_DYNAMODB_TABLE,
    Key: {
      key: "feedback",
      version: "1",
    },
  })) as FeedbackConfigDBEntry;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const configInSpecificLanguage = pickAppropriateFeedbackOptions(
    feedbackConfig.data,
    req.headers["accept-language"]
  );

  res.send(configInSpecificLanguage);
};

export const pickAppropriateFeedbackOptions = (
  feedbackData: object,
  prefferedLangauge?: string
) => {
  let locale = prefferedLangauge ?? DEFAULT_LOCALE;

  const [language, country] = locale.split(/[_-]/);

  locale = [language, country].join("_");

  if (locale in feedbackData) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return feedbackData[locale];
  }

  if (language in feedbackData) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return feedbackData[language];
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return feedbackData[DEFAULT_LOCALE];
};
