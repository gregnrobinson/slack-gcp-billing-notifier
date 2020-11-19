const slack = require('slack');

// TODO(developer) replace these with your own values
const BOT_ACCESS_TOKEN =
  process.env.BOT_ACCESS_TOKEN || 'xxxx-111111111111-abcdefghidklmnopq';
const CHANNEL = process.env.SLACK_CHANNEL || 'general';

exports.notifySlack = async data => {

  //Extract data from the Pub/Sub Message
  const pubsubMessage = data;
  const pubsubData = JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString());
  const formatter = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 2})
  const costAmount = formatter.format(pubsubData.costAmount);
  const budgetAmount = formatter.format(pubsubData.budgetAmount);
  const budgetName = pubsubData.budgetDisplayName;
  let threshold = (pubsubData.alertThresholdExceeded*100).toFixed(0);    
  
  //Check if threshold is 0 or not. If so, don't notify. This will avoid Pub/Subs 30 minute frequency of sending messages.
  if (!isFinite(threshold)){
    threshold = 0;
  } else if (threshold == 0) {
    return 'No need to notify team, budget is 0% utilized';
  } 

  if (threshold == 0){
    return 'No need to notify team, budget is 0% utilized';
  }

  //Set Emoticon based on threshold percentage
  const emoticon = threshold >= 90 ? ':fire:' : ':smile:';

  //Test to be sent to Slack
  notification = `${emoticon} ${budgetName} \n\nThis is an automated notification to inform you that the billing account has exceeded ${threshold}% of the monthly budget of ${budgetAmount}.\n\nThe billing account has accrued ${costAmount} in costs so far for the month.`

  //Post to Slack channel with Bot Token
  await slack.chat.postMessage({
    token: BOT_ACCESS_TOKEN,
    channel: CHANNEL,
    text: notification,
  });

  return 'Slack notification sent successfully';
};
