const slack = require('slack');
const {BigQuery} = require('@google-cloud/bigquery');

const CHANNEL = 'billing';
const DATASET = 'billing'
const TABLE = 'budget';
const PROJECT = process.env.GCP_PROJECT;
const DATASET_LOCATION = 'northamerica-northeast1';
const bigquery = new BigQuery();
const BOT_ACCESS_TOKEN = process.env.BOT_ACCESS_TOKEN;

exports.notifySlack = async (data, context) => {
  
    const pubsubMessage = data;
    const pubsubData = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString());
    const formatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 2})
    const budgetId = pubsubMessage.attributes.budgetId;
    const costAmount = formatter.format(pubsubData.costAmount);
    const budgetAmount = formatter.format(pubsubData.budgetAmount);
    const budgetName = pubsubData.budgetDisplayName;
    const createdAt = new Date().toISOString();
    let threshold = parseInt((pubsubData.alertThresholdExceeded*100).toFixed(0));
    
    if (!isFinite(threshold)){
        threshold = 0;
    }
    //Create Rows to be placed in BigQuery
    const rows = [{createdAt: createdAt, 
                    costAmount: pubsubData.costAmount, 
                    budgetAmount:pubsubData.budgetAmount, 
                    budgetId: budgetId,
                    budgetName: budgetName,
                    threshold: threshold}]

    
    //Send to BigQuery Table
    await bigquery.dataset(DATASET).table(TABLE).insert(rows);
    
    //Query the most recent data in BigQuery
    const query = `SELECT count(*) cnt
                    FROM \`${PROJECT}.${DATASET}.${TABLE}\`
                    WHERE createdAt >  TIMESTAMP( DATE(EXTRACT(YEAR FROM CURRENT_DATE()) , EXTRACT(MONTH FROM CURRENT_DATE()), 1)) 
                    AND Threshold = ${threshold} and BudgetId = '${budgetId}'
                    `;

    const options = {
        query: query,
        location: DATASET_LOCATION,
    };

    const [job] = await bigquery.createQueryJob(options);

    // Wait for the query to finish
    const [results] = await job.getQueryResults();
 
    // If a notification was sent and the data remains the same for the second notification. Dont send another message.
    if (results.length > 0 && results[0].cnt > 1 ){
        return;
    }
    
    //Emoji based on threshold
    const emoticon = threshold >= 90 ? ':fire:' : ':smiley:';

    //Slack message
    notification = `${emoticon} ${budgetName} \n\nThis is an automated notification to inform you that the billing account for hiptogive.org has exceeded ${threshold}% of the monthly budget of ${budgetAmount}.\n\nThe billing account has accrued ${costAmount} in costs so far for the month.`

    //Post to Slack channel with Bot Token
    await slack.chat.postMessage({
      token: BOT_ACCESS_TOKEN,
      channel: CHANNEL,
      text: notification,
    });

  return 'Slack notification sent successfully';
};