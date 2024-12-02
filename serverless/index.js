const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const mailgun = require('mailgun-js');
const AWS = require('aws-sdk');

//this decodes our gcp private key
const decodePrivateKey = JSON.parse(Buffer.from(process.env.gcpPrivateKey, "base64").toString());
 
//Consolelogging in lamda
console.log("cred", decodePrivateKey);
console.log("bucket", process.env.gcpBucketName);
console.log("pk", decodePrivateKey.private_key);

 //creating a storage for accessing the env. 
const storageCredentials = new Storage({
  credentials: {
    project_id: process.env.gcpProjId,
    client_email: process.env.gcpEmail,
    private_key: decodePrivateKey.private_key,
  }
})

//handler for the emails. 
exports.handler = async (event, context) => {
      console.log("Lambda is running");
      console.log("Event:", JSON.stringify(event, null, 2));

    //removes the response from SNS. 
      const response = event.Records[0].Sns.Message;
    //spilts the response with ","

      const [email,url] = response.split(',');
    //printing email message and url
      console.log('Response', response);
      console.log('Email', email);

      console.log('URL', url);

      //sending emails via mailgun domain
      const mg= mailgun({
        apiKey: "a20d6b47dfc768ac8c964dc198371b3f-30b58138-c4c82650",
        domain: "aditij.me",
    });

      const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").split(".")[0];
      const submittedassignment = `assignment_${timestamp}`;
      const uploadurl = `${submittedassignment}_${Math.random().toString(36).substring(2, 15)}.zip`;
   

    try{

      //DOWNLAODING THE URL AND KEEPING IT IN THE GCP BUCKET
   
      const downloadData = await axios.get(url, { responseType: "arraybuffer" });
      const filecontent = Buffer.from(downloadData.data);
   
      const filename = `${email}${Date.now()}_${Math.random().toString(36).substring(2, 15)}.zip`; 
      const gcpBucketName = process.env.gcpBucketName;
      const bucket = storageCredentials.bucket(gcpBucketName);
   
      await storageCredentials.bucket(gcpBucketName).file(filename).save(filecontent);
      console.log("File uploaded to bucket:", uploadurl);
   
      const data = {
        from: process.env.sourceEmail,
        to: email,
        subject: "Assignment Submitted Successfully",
        text: `Dear User,
        Your assignment is submitted successfully`,
      };
   
      try {
        console.log("Inside Success try block");
        dynamo(email,timestamp,"success");
        const result = await mg.messages().send(data);
        console.log("success email is sent successfully:", result);
      } catch (error) {
        console.error("Error sending Success email:", error.message || error);
        console.error("Complete error object:", JSON.stringify(error, null, 2));
      }
    } catch (e) {
      const data = {
        from: process.env.sourceEmail,
        to: email,
        subject: "Error submitting the assignment",
        text: `Dear User,

        We regret to inform you that there was an issue with the submission of your assignment. Please review the details below:
        
        Details:
        - Submitted URL: ${url}
        - Timestamp: ${new Date().toGMTString()}
        
        Please ensure that the provided URL is correct and try to submit again. If the issue persists, contact your professor or TA for assistance.
        
        Sincerely,
        Submission Team`,
      };
   
      try {
        console.log("Inside error try block");
        dynamo(email,timestamp,"error");
        const result = await mg.messages().send(data);
        console.log("Error email is sent successfully", result);
      } catch (error) {
        console.error("Error sending Failure email:", error.message || error);
        console.error("error object:", JSON.stringify(error, null, 2));
      }
    }
    
      //If its successfully run then it will pirnt in cloudwatch
      return {
        statusCode: 200,
        body: JSON.stringify('Lambda function executed successfully'),
      };
    };

    async function dynamo(EmailId, Timestamp, Status) {
      const dynamoDB = new AWS.DynamoDB.DocumentClient();
      const timestamp = new Date().toISOString(); //timestamp from the dynamo
    
      const params = {
        TableName: process.env.dynamoTable,
        Item: {
          id: timestamp,
          EmailId,
          Timestamp,
          Status,
        },
      };
      console.log("end of the function");
      await dynamoDB.put(params).promise();
    }