import AWS from "./aws";

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

export default class SQS {
  constructor(queueUrl) {
    this.queueUrl = queueUrl;
  }

  sendMessage = (json) =>
    new Promise((resolve, reject) =>
      sqs.sendMessage(
        {
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(json),
        },
        (err, data) => (err ? reject(err) : resolve(data.MessageId))
      )
    );
}
