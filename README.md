# Setup

This setup explains how to start receiving budget notifications on slack. The Services used in this setup include Pub/Sub, Budgets, BigQuery, and Cloud Functions. A Budget message will be sent to Pub/Sub which will trigger a Cloud Function where the function uses the submitted Pub/Sub data to create an entry in a table within BigQuery. After data has been sent a query takes places followed by a condition to ensure that duplicate messages are not sent to Slack.

![alt text](https://github.com/gregnrobinson/slack-gcp-billing-notifier/blob/main/images/architecture.png "Architecture")


1. Go to https://api.slack.com/apps and create an applicarion with the following permissions under ***OAuth and Permissions > Scopes > Bot Token Scopes.***

    - chat:write.public
    - channels:join
    - chat:write
    - chat:write.customize

2. Save the Bot User OAuth Access Token somewhere as it is needed for the Cloud Function.

3. In BigQuery, add a new dataset called ***billing*** and create a new table called ***budget***. The schema for the table is shown below:
```
[
 {
 "name": "createdAt",
 "type": "TIMESTAMP",
 "mode": "NULLABLE"
 },
 {
 "name": "costAmount",
 "type": "NUMERIC",
 "mode": "NULLABLE"
 },
 {
 "name": "budgetAmount",
 "type": "NUMERIC",
 "mode": "NULLABLE"
 },
 {
 "name": "budgetName",
 "type": "STRING",
 "mode": "NULLABLE"
 },
 {
 "name": "budgetId",
 "type": "STRING",
 "mode": "NULLABLE"
 },
 {
 "name": "threshold",
 "type": "NUMERIC",
 "mode": "NULLABLE"
 }
 ]
```

4. Create a new Cloud Pub/Sub topic called ***billing-alerts***. This topic will be used for the billing alert publisher.

5. Navigate to Billing in the Google Cloud Console and create a budget. When creating your budget, modify "Manage notifications" to configure the Cloud Pub/Sub topic ***billing-alerts*** that was created in the previous step¹.

6. Navigate to Cloud Functions in the Google Cloud Console and create a new cloud function with the following settings:

    - Name: slack-billing-notification
    - Trigger: Cloud Pub/Sub
    - Topic: ***billing-alerts***
    - Source code: inline editor
    - Runtime: Node.js 10
    - Function to execute: notifySlack

7. Configure two Runtime variables:

    - GCP_PROJECT: The project to be used for the BigQuery Dataset.
    - BOT_ACCESS_TOKEN: The Bot Token that was created in the first step.

8. Add the index.js and package.json files to the inline editor.

9. Click deploy.

# Testing

It is requried to encode the Pub/Sub test data as Base64. The snippet below is some plain JSON data that would be similar to the actual data.
```
{
 "costAmount": 501,
 "budgetAmount": 1000,
 "budgetDisplayName": "test",
 "alertThresholdExceeded": 0.50
}
```

We need to take that plain JSON and convert it to Base64 format. You can do this by going to https://www.browserling.com/tools/json-to-base64. The result is this.
```
ewogImNvc3RBbW91bnQiOiA1MDEsCiAiYnVkZ2V0QW1vdW50IjogMTAwMCwKICJidWRnZXREaXNwbGF5TmFtZSI6ICJ0ZXN0IiwKICJhbGVydFRocmVzaG9sZEV4Y2VlZGVkIjogMC41MAp9
```

Finally we put that output into the following JSON. Use this message as the test input for the Cloud Function.
```
{
 "data": "ewogImNvc3RBbW91bnQiOiA1MDEsCiAiYnVkZ2V0QW1vdW50IjogMTAwMCwKICJidWRnZXREaXNwbGF5TmFtZSI6ICJ0ZXN0IiwKICJhbGVydFRocmVzaG9sZEV4Y2VlZGVkIjogMC41MAp9",
 "attributes": {
       "budgetId": "test"
 }
}
```

And that is all, you should see a notification when you run the test. The result should be...

![alt text](https://github.com/gregnrobinson/slack-gcp-billing-notifier/blob/main/images/slack_notification.png "Slack Example Notification")

I recommend adding an icon to the app to make it pretty. You can do that here: https://api.slack.com/apps.


