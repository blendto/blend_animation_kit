import DynamoDB from "server/external/dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

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
    TableName: process.env.CONFIG_DYNAMODB_TABLE,
    Key: {
      key: "feedback",
      version: "1",
    },
  })) as FeedbackConfigDBEntry;

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
    return feedbackData[locale];
  }

  if (language in feedbackData) {
    return feedbackData[language];
  }

  return feedbackData[DEFAULT_LOCALE];
};
