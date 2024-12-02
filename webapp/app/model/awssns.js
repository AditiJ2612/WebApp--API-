const AWS = require('aws-sdk');
const configureDB  = require('../config/configureDB');


AWS.config.update({ region: 'us-east-1' });

const sns = new AWS.SNS();

const topicArn = configureDB.TOPIC_ARN;

const msg = 'Hello, Hello World';

function publishMessage(topicArn,msg) {
const params = {
  Message: msg,
  TopicArn: topicArn,
};

sns.publish(params, (err, data) => {
  if (err) {
    console.error('Error publishing message to SNS:', err);
  } else {
    console.log('Message published to SNS:', data.MessageId);
  }
});
}

module.exports = {
    publishMessage,
};