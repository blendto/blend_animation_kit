import AWS from "./aws";

var sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

export default class SQS {
  constructor(queueUrl) {
    this.queueUrl = queueUrl;
  }

  sendMessage = (json) => {
    return new Promise((resolve, reject) => {
      sqs.sendMessage(
        {
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(json),
        },
        (err, data) => {
          if (err) {
            return reject(err);
          }
          resolve(data.MessageId);
        }
      );
    });
  };
}
