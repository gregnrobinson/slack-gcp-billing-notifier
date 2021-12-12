const slack = require('slack');
const {BigQuery} = require('@google-cloud/bigquery');

const CHANNEL = 'billing';
const DATASET = 'phronesis_gcp_billing'
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
    //save data 
    const rows = [{createdAt: createdAt, 
                    costAmount: pubsubData.costAmount, 
                    budgetAmount:pubsubData.budgetAmount, 
                    budgetId: budgetId,
                    budgetName: budgetName,
                    threshold: threshold}]

    
    await bigquery.dataset(DATASET).table(TABLE).insert(rows);
    

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
 
    if (results.length > 0 && results[0].cnt > 1 ){
        return;
    }
    
    const emoticon = threshold >= 90 ? ':fire:' : ':smiley:';

    //Test to be sent to Slack
    notification = `${emoticon} ${budgetName} \n\nThis is an automated notification to inform you that the Phronesis billing account has exceeded ${threshold}% of the monthly budget of ${budgetAmount}.\n\nThe billing account has accrued ${costAmount} in costs so far for the month.`

    //Post to Slack channel with Bot Token
    await slack.chat.postMessage({
      token: BOT_ACCESS_TOKEN,
      channel: CHANNEL,
      text: notification,
    });

  return 'Slack notification sent successfully';
};
